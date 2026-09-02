import { writeFile } from "node:fs/promises";

const port = process.env.FLOW_AUDIT_CDP_PORT ?? "9227";
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("No Chrome page target found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve) => socket.addEventListener("open", resolve, { once: true }));
let nextId = 0;
const call = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const listener = (event) => {
    const message = JSON.parse(event.data);
    if (message.id !== id) return;
    socket.removeEventListener("message", listener);
    if (message.error) reject(message.error);
    else resolve(message.result);
  };
  socket.addEventListener("message", listener);
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const pause = (milliseconds = 300) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const navigate = async (path) => {
  await call("Page.navigate", { url: `http://127.0.0.1:3000${path}` });
  await pause(850);
};
const data = () => evaluate("JSON.parse(localStorage.getItem('flow.cash-planner.v4'))");
const setInput = (selector, value) => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw new Error('Missing input: '+${JSON.stringify(selector)});input.focus();const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return input.value})()`);
const setRowInput = (label, value) => evaluate(`(()=>{const row=[...document.querySelectorAll('.transaction-form .form-row')].find((item)=>item.querySelector('span')?.textContent===${JSON.stringify(label)});if(!row)throw new Error('Missing row: '+${JSON.stringify(label)});const input=row.querySelector('input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return input.value})()`);
const results = {};

await call("Runtime.enable");
await call("Page.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate("localStorage.clear(); true");
await call("Page.reload", { ignoreCache: true });
await pause(900);

await evaluate(`(()=>{
  const current=JSON.parse(localStorage.getItem('flow.cash-planner.v4'));
  const legacy={
    ...current,
    funds:current.funds.filter((fund)=>fund.kind!=='income'),
    transactions:current.transactions.map((transaction)=>transaction.type==='expense'&&transaction.expenseKind!=='variable'&&transaction.recurrence?{...transaction,fundId:'savings'}:transaction),
  };
  localStorage.setItem('flow.cash-planner.v3',JSON.stringify(legacy));
  localStorage.removeItem('flow.cash-planner.v4');
  return true;
})()`);
await call("Page.reload", { ignoreCache: true });
await pause(900);

const migrated = await data();
const incomeFund = migrated.funds.find((fund) => fund.kind === "income");
const fixed = migrated.transactions.filter((transaction) => transaction.type === "expense" && transaction.expenseKind !== "variable" && transaction.recurrence);
results.migration = {
  incomeCreated: Boolean(incomeFund),
  fixedCount: fixed.length,
  allFixedUseIncome: fixed.every((transaction) => transaction.fundId === incomeFund?.id),
  savingsPreserved: migrated.funds.find((fund) => fund.kind === "savings")?.balance,
};

await setInput(".income-entry input", "3200");
await pause();
const afterIncome = await data();
const key = new Date().toISOString().slice(0, 7);
const expectedPaid = fixed.filter((transaction) => (transaction.recurrence?.paymentDay ?? 1) <= new Date().getDate()).reduce((sum, transaction) => sum + transaction.amount, 0);
results.incomeLedger = {
  recorded: afterIncome.funds.find((fund) => fund.kind === "income")?.monthlyBalances?.[key],
  expectedPaid,
  expectedRemaining: 3200 - expectedPaid,
  rendered: await evaluate("[...document.querySelectorAll('.income-stat strong')].map((item)=>item.textContent)"),
  inputFont: await evaluate("getComputedStyle(document.querySelector('.income-entry input')).fontSize"),
};

await navigate("/settings");
results.fixedRowsUseIncome = await evaluate("[...document.querySelectorAll('.fixed-expense-main small')].every((item)=>item.textContent.includes('Income'))");
await evaluate("[...document.querySelectorAll('button')].find((button)=>button.textContent.includes('Add fixed expense')).click(); true");
await pause();
results.fixedPreset = await evaluate("JSON.stringify({fund:[...document.querySelectorAll('.transaction-form .form-row')].find((row)=>row.querySelector('span')?.textContent==='Fund')?.querySelector('select')?.value,recurring:document.querySelector('.switch-row input')?.checked})").then(JSON.parse);
await setInput('input[aria-label="Amount"]', "100");
await setInput('input[placeholder="What is it?"]', "Audit future fixed");
await setRowInput("Payment day", "28");
await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();

await navigate("/");
results.futureExpense = {
  rendered: await evaluate("[...document.querySelectorAll('.income-stat strong')].map((item)=>item.textContent)"),
  upcomingCopy: await evaluate("document.querySelector('.income-remaining small').textContent"),
};

await navigate("/settings");
await evaluate("document.querySelector('button[aria-label=\"Edit Audit future fixed\"]').click(); true");
await pause();
await setRowInput("Payment day", "1");
await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();
await navigate("/");
results.passedExpense = {
  rendered: await evaluate("[...document.querySelectorAll('.income-stat strong')].map((item)=>item.textContent)"),
  noHorizontalOverflow: await evaluate("document.documentElement.scrollWidth===innerWidth"),
};

await evaluate("document.querySelector('.income-ledger').scrollIntoView({block:'center'}); true");
await pause();
const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("/private/tmp/flow-v13-income-mobile.png", Buffer.from(screenshot.data, "base64"));
console.log(JSON.stringify(results, null, 2));
socket.close();
