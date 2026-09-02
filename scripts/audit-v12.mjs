import { writeFile } from "node:fs/promises";

const port = process.env.FLOW_AUDIT_CDP_PORT ?? "9226";
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
const data = () => evaluate("JSON.parse(localStorage.getItem('flow.cash-planner.v3'))");
const setInput = (selector, value) => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw new Error('Missing input: '+${JSON.stringify(selector)});input.focus();const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return input.value})()`);
const results = {};

await call("Runtime.enable");
await call("Page.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate("localStorage.clear(); true");
await call("Page.reload", { ignoreCache: true });
await pause(900);

results.migration = await data().then((value) => ({
  savings: value.funds.find((fund) => fund.kind === "savings"),
  tax: value.funds.find((fund) => fund.kind === "tax"),
}));

await evaluate("document.querySelector('.savings-card .fund-accounts-tab').click(); true");
await pause();
const savingsBalanceInput = '.savings-card .fund-account-row input[type="number"]';
await setInput(savingsBalanceInput, "");
const afterClear = await evaluate(`document.querySelector(${JSON.stringify(savingsBalanceInput)}).value`);
await setInput(savingsBalanceInput, "1234");
await pause();
results.numberEditing = {
  afterClear,
  afterTyping: await evaluate(`document.querySelector(${JSON.stringify(savingsBalanceInput)}).value`),
  saved: (await data()).funds.find((fund) => fund.kind === "savings").balance,
};

await evaluate("document.querySelector('.savings-card .add-account-button').click(); true");
await pause();
results.accountAdded = (await data()).funds.find((fund) => fund.kind === "savings").accounts.length === 2;
await evaluate("window.confirm=()=>true; [...document.querySelectorAll('.savings-card .fund-account-row button')].at(-1).click(); true");
await pause();
results.accountDeleted = (await data()).funds.find((fund) => fund.kind === "savings").accounts.length === 1;

await navigate("/settings");
results.mobileInputFont = await evaluate("getComputedStyle(document.querySelector('.setting-row input')).fontSize");
results.fixedMenuCount = await evaluate("document.querySelectorAll('.fixed-expense-row').length");
await evaluate("document.querySelector('button[aria-label=\"Edit Spotify\"]').click(); true");
await pause();
await setInput('input[aria-label="Amount"]', "15");
await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();
results.fixedEdited = (await data()).transactions.find((item) => item.id === "spotify").amount;

await navigate("/transactions");
await evaluate("document.querySelector('button[aria-label=\"Edit Groceries\"]').click(); true");
await pause();
await setInput('input[aria-label="Amount"]', "91.5");
await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();
results.expenseEdited = (await data()).transactions.find((item) => item.id === "groceries").amount;
await evaluate("document.querySelector('button[aria-label=\"Edit Groceries\"]').click(); true");
await pause();
await evaluate("window.confirm=()=>true; [...document.querySelectorAll('.delete-sheet-button')][0].click(); true");
await pause();
results.expenseDeleted = !(await data()).transactions.some((item) => item.id === "groceries");

await navigate("/");
const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("/private/tmp/flow-v12-mobile.png", Buffer.from(screenshot.data, "base64"));
results.mobile = await evaluate("JSON.stringify({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,accountsTabs:document.querySelectorAll('.fund-accounts-tab').length,bottomNav:document.querySelectorAll('.bottom-nav a').length})").then(JSON.parse);

console.log(JSON.stringify(results, null, 2));
socket.close();
