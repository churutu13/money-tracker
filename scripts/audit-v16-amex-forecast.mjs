import { writeFile } from "node:fs/promises";

const port = process.env.FLOW_AUDIT_CDP_PORT ?? "9229";
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
    if (message.error) reject(message.error); else resolve(message.result);
  };
  socket.addEventListener("message", listener);
  socket.send(JSON.stringify({ id, method, params }));
});
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const pause = (milliseconds = 350) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const navigate = async (path) => { await call("Page.navigate", { url: `http://127.0.0.1:3000${path}` }); await pause(850); };
const setInput = (selector, value) => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw new Error('Missing input: '+${JSON.stringify(selector)});input.focus();const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return input.value})()`);
const setInputAt = (selector, index, value) => evaluate(`(()=>{const input=document.querySelectorAll(${JSON.stringify(selector)})[${index}];if(!input)throw new Error('Missing indexed input');input.focus();const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return input.value})()`);
const data = () => evaluate("JSON.parse(localStorage.getItem('flow.cash-planner.v6'))");
const screenshot = async (path) => { const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false }); await writeFile(path, Buffer.from(shot.data, "base64")); };

await call("Runtime.enable");
await call("Page.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await navigate("/");
await evaluate("localStorage.clear(); true");
await call("Page.reload", { ignoreCache: true });
await pause(900);

await evaluate(`(()=>{const current=JSON.parse(localStorage.getItem('flow.cash-planner.v6'));const income=current.funds.find((fund)=>fund.kind==='income');delete income.cycleEntries;income.monthlyBalances={'2026-07':3000};current.plans=[{id:'legacy-plan'}];localStorage.setItem('flow.cash-planner.v5',JSON.stringify(current));localStorage.removeItem('flow.cash-planner.v6');return true})()`);
await call("Page.reload", { ignoreCache: true });
await pause(900);

const results = {};
const migrated = await data();
results.migration = {
  v6Created: Boolean(migrated),
  plansRemoved: !("plans" in migrated),
  previousCycleImported: migrated.funds.find((fund) => fund.kind === "income")?.cycleEntries?.["2026-07"]?.income,
  inheritedCopy: await evaluate("document.querySelector('.cycle-ledger-note').textContent"),
  nav: await evaluate("[...document.querySelectorAll('.bottom-nav span')].map((item)=>item.textContent)"),
};

await setInputAt(".cycle-input input", 0, "3200");
await setInputAt(".cycle-input input", 1, "1400");
await setInputAt(".cycle-input input", 2, "600");
await pause();
results.homeCycle = {
  stored: (await data()).funds.find((fund) => fund.kind === "income")?.cycleEntries?.["2026-08"],
  remaining: await evaluate("document.querySelector('.cycle-result strong').textContent"),
  noOverflow: await evaluate("document.documentElement.scrollWidth===innerWidth"),
};
await evaluate("document.querySelector('.cycle-ledger').scrollIntoView({block:'center'}); true");
await pause();
await screenshot("/private/tmp/flow-v16-home-mobile.png");

await navigate("/forecast");
results.forecastInitial = {
  inputs: await evaluate("[...document.querySelectorAll('.manual-defaults input')].map((input)=>input.value)"),
  removedControls: await evaluate("![...document.querySelectorAll('button')].some((button)=>['Simulate','base','realistic','custom'].includes(button.textContent.trim()))"),
  noPlansOrOneTime: await evaluate("!document.body.innerText.includes('Plans')&&!document.body.innerText.includes('One-time')"),
};
await setInputAt(".manual-defaults input", 0, "3200");
await setInputAt(".manual-defaults input", 1, "1400");
await setInputAt(".manual-defaults input", 2, "600");
await pause();
await setInputAt(".selected-cycle-inputs input", 0, "3500");
await pause();
results.forecastEdited = {
  firstCycleEnd: await evaluate("document.querySelector('.manual-cycle-result strong').textContent"),
  after24: await evaluate("document.querySelector('.forecast-summary article strong').textContent"),
  persisted: JSON.parse(await evaluate("localStorage.getItem('flow.manual-forecast.v1')")),
  noOverflow: await evaluate("document.documentElement.scrollWidth===innerWidth"),
};
await screenshot("/private/tmp/flow-v16-forecast-mobile.png");

await navigate("/amex");
await evaluate("document.querySelector('.fab').click(); true");
await pause();
results.amexPreset = {
  method: await evaluate("document.querySelector('select[aria-label=\"Payment method\"]').value"),
  recurringHidden: await evaluate("![...document.querySelectorAll('.switch-row span')].some((span)=>span.textContent.includes('Recurring'))"),
};
await setInput("input[aria-label=\"Amount\"]", "125.50");
await setInput("input[placeholder=\"What is it?\"]", "Amex dinner");
await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();
const afterPurchase = await data();
results.amexPurchase = {
  transaction: afterPurchase.transactions.find((transaction) => transaction.name === "Amex dinner"),
  availableUnchanged: afterPurchase.funds.find((fund) => fund.kind === "available")?.balance,
  total: await evaluate("document.querySelector('.amex-overview article strong').textContent"),
};

await navigate("/");
results.homeBeforeReserve = {
  raw: await evaluate("document.querySelector('.balance-card>strong').textContent"),
  split: await evaluate("[...document.querySelectorAll('.available-split strong')].map((item)=>item.textContent)"),
};
await navigate("/amex");
await evaluate("document.querySelector('.amex-check').click(); true");
await pause();
const afterReserve = await data();
results.reserve = {
  reserved: afterReserve.transactions.find((transaction) => transaction.name === "Amex dinner")?.amexReserved,
  available: afterReserve.funds.find((fund) => fund.kind === "available")?.balance,
  effective: await evaluate("document.querySelector('.amex-available strong').textContent"),
  currentCycle: await evaluate("document.querySelector('.amex-overview article small').textContent"),
};
await screenshot("/private/tmp/flow-v16-amex-mobile.png");

await evaluate(`(()=>{const current=JSON.parse(localStorage.getItem('flow.cash-planner.v6'));current.transactions.unshift({id:'audit-passed-recurring',name:'Passed recurring audit',amount:10,type:'expense',date:'2026-08-01',fundId:'income',expenseKind:'fixed',paymentMethod:'bank',createdAt:new Date().toISOString(),recurrence:{frequency:'monthly',paymentDay:26,startDate:'2026-01-01'}});localStorage.setItem('flow.cash-planner.v6',JSON.stringify(current));return true})()`);
await navigate("/transactions");
await call("Page.reload", { ignoreCache: true });
await pause(900);
results.transactionColours = {
  incomeGreen: await evaluate("document.querySelectorAll('.timeline-amount.status-income').length"),
  expenseRed: await evaluate("document.querySelectorAll('.timeline-amount.status-expense').length"),
  recurringYellow: await evaluate("document.querySelectorAll('.timeline-amount.status-recurring-upcoming').length"),
  recurringBlue: await evaluate("document.querySelectorAll('.timeline-amount.status-recurring-passed').length"),
  amexFilter: await evaluate("[...document.querySelectorAll('.filters button')].some((button)=>button.textContent==='amex')"),
  noOverflow: await evaluate("document.documentElement.scrollWidth===innerWidth"),
};

console.log(JSON.stringify(results, null, 2));
socket.close();
