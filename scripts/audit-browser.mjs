import { writeFile } from "node:fs/promises";

const debugPort = process.env.FLOW_AUDIT_CDP_PORT ?? "9226";
const pages = await fetch(`http://127.0.0.1:${debugPort}/json`).then((response) => response.json());
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
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
};
const pause = (milliseconds = 250) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const navigate = async (path) => { await call("Page.navigate", { url: `http://127.0.0.1:3000${path}` }); await pause(900); await evaluate("window.confirm=()=>true; true"); };
const data = () => evaluate("JSON.parse(localStorage.getItem('flow.cash-planner.v3'))");
const results = {};

await call("Runtime.enable");
await call("Page.enable");
await evaluate("localStorage.clear(); true");
await call("Page.reload", { ignoreCache: true });
await pause(800);
await evaluate("window.confirm=()=>true; true");
results.initial = await evaluate("JSON.stringify({available:[...document.querySelectorAll('.balance-card > strong')][0]?.textContent,savings:[...document.querySelectorAll('.savings-card > strong')][0]?.textContent,tax:[...document.querySelectorAll('.reserve-card > strong')][0]?.textContent})").then(JSON.parse);

await evaluate("document.querySelector('[data-testid=add-transaction]').click(); true");
await pause();
await evaluate(`(()=>{const set=(el,v)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};set(document.querySelector('input[aria-label="Amount"]'),'100');set(document.querySelector('input[placeholder="What is it?"]'),'Audit coffee');return true})()`);
await pause(); await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();
results.expenseAdded = await data().then((value) => ({ balance: value.funds.find((fund) => fund.id === "available").balance, exists: value.transactions.some((item) => item.name === "Audit coffee") }));

await navigate("/transactions");
await evaluate("document.querySelector('button[aria-label=\"Edit Audit coffee\"]').click(); true");
await pause();
await evaluate(`(()=>{const el=document.querySelector('input[aria-label="Amount"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'120');el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
await pause(); await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();
results.expenseEdited = await data().then((value) => ({ available: value.funds.find((fund) => fund.id === "available").balance, savings: value.funds.find((fund) => fund.id === "savings").balance, transaction: value.transactions.find((item) => item.name === "Audit coffee") }));
await evaluate("document.querySelector('button[aria-label=\"Edit Audit coffee\"]').click(); true"); await pause(); await evaluate("[...document.querySelectorAll('.transaction-form button')].find((button)=>button.textContent.includes('Duplicate transaction')).click(); true"); await pause();
results.expenseDuplicated = await data().then((value) => ({ available: value.funds.find((fund) => fund.id === "available").balance, copyExists: value.transactions.some((item) => item.name === "Audit coffee copy") }));
await navigate("/transactions"); await evaluate("document.querySelector('button[aria-label=\"Edit Audit coffee copy\"]').click(); true"); await pause(); await evaluate("document.querySelector('button[aria-label=\"Delete transaction\"]').click(); true"); await pause();
await evaluate("document.querySelector('button[aria-label=\"Edit Audit coffee\"]').click(); true");
await pause();
await evaluate("document.querySelector('button[aria-label=\"Delete transaction\"]').click(); true");
await pause();
results.expenseDeleted = await data().then((value) => ({ available: value.funds.find((fund) => fund.id === "available").balance, savings: value.funds.find((fund) => fund.id === "savings").balance, exists: value.transactions.some((item) => item.name === "Audit coffee") }));

await evaluate("document.querySelector('[data-testid=add-transaction]').click(); true");
await pause();
await evaluate(`(()=>{const buttons=[...document.querySelectorAll('.type-segment button')];buttons.find((button)=>button.textContent==='transfer').click();return true})()`); await pause();
await evaluate(`(()=>{const set=(el,v)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};set(document.querySelector('input[aria-label="Amount"]'),'50');set(document.querySelector('input[placeholder="What is it?"]'),'Audit transfer');return true})()`); await pause(); await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();
results.transferAdded = await data().then((value) => ({ available: value.funds.find((fund) => fund.id === "available").balance, savings: value.funds.find((fund) => fund.id === "savings").balance }));
await navigate("/transactions");
await evaluate("document.querySelector('button[aria-label=\"Edit Audit transfer\"]').click(); true"); await pause(); await evaluate("document.querySelector('button[aria-label=\"Delete transaction\"]').click(); true"); await pause();
results.transferDeleted = await data().then((value) => ({ available: value.funds.find((fund) => fund.id === "available").balance, savings: value.funds.find((fund) => fund.id === "savings").balance }));

await evaluate("document.querySelector('[data-testid=add-transaction]').click(); true"); await pause();
await evaluate(`(()=>{const set=(el,v)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,v);el.dispatchEvent(new Event('input',{bubbles:true}))};set(document.querySelector('input[aria-label="Amount"]'),'10');set(document.querySelector('input[placeholder="What is it?"]'),'Audit weekly');document.querySelector('.switch-row input').click();return true})()`); await pause();
await evaluate(`(()=>{const select=[...document.querySelectorAll('.transaction-form select')].find((item)=>[...item.options].some((option)=>option.value==='weekly'));const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;setter.call(select,'weekly');select.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); await pause();
await evaluate(`(()=>{const set=(label,value)=>{const row=[...document.querySelectorAll('.transaction-form .form-row')].find((item)=>item.querySelector('span')?.textContent===label);const el=row.querySelector('input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))};set('Every','2');set('Number of payments','3');return true})()`); await pause(); await evaluate("document.querySelector('.transaction-form').requestSubmit(); true"); await pause();
results.weeklyRecurring = await data().then((value) => { const transaction = value.transactions.find((item) => item.name === "Audit weekly"); return { recurrence: transaction?.recurrence, available: value.funds.find((fund) => fund.id === "available").balance }; });
await navigate("/transactions"); await evaluate("document.querySelector('button[aria-label=\"Edit Audit weekly\"]').click(); true"); await pause(); await evaluate("document.querySelector('button[aria-label=\"Delete transaction\"]').click(); true"); await pause();

await navigate("/plans");
await evaluate("[...document.querySelectorAll('button')].find((button)=>button.textContent.includes('New plan')).click(); true"); await pause();
await evaluate(`(()=>{const set=(label,value)=>{const row=[...document.querySelectorAll('.plan-modal .form-row')].find((item)=>item.querySelector('span')?.textContent===label);const el=row.querySelector('input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}))};set('Name','Audit plan');set('Original amount','1200');set('Monthly payment','100');set('Total payments','12');return true})()`); await pause(); await evaluate("document.querySelector('.plan-modal').requestSubmit(); true"); await pause();
results.planAdded = await data().then((value) => value.plans.some((item) => item.name === "Audit plan"));
await evaluate("document.querySelector('button[aria-label=\"Edit Audit plan\"]').click(); true"); await pause();
await evaluate(`(()=>{const row=[...document.querySelectorAll('.plan-modal .form-row')].find((item)=>item.querySelector('span')?.textContent==='Monthly payment');const el=row.querySelector('input');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'125');el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await pause(); await evaluate("document.querySelector('.plan-modal').requestSubmit(); true"); await pause();
results.planEdited = await data().then((value) => value.plans.find((item) => item.name === "Audit plan")?.monthlyPayment);
await evaluate("document.querySelector('button[aria-label=\"Edit Audit plan\"]').click(); true"); await pause(); await evaluate("[...document.querySelectorAll('.plan-modal button')].find((button)=>button.textContent.includes('Delete')).click(); true"); await pause();
results.planDeleted = await data().then((value) => !value.plans.some((item) => item.name === "Audit plan"));

await navigate("/settings");
const salaryCount = await data().then((value) => value.salaryProfiles.length);
await evaluate("document.querySelector('button[aria-label=\"Add salary profile\"]').click(); true"); await pause();
await evaluate(`(()=>{const el=[...document.querySelectorAll('.settings-card input')].find((item)=>item.value==='New salary');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'Audit salary');el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await pause();
results.salaryAddedEdited = await data().then((value) => value.salaryProfiles.some((item) => item.name === "Audit salary") && value.salaryProfiles.length === salaryCount + 1);
await evaluate("[...document.querySelectorAll('button')].find((button)=>button.textContent.includes('Delete salary profile')).click(); true"); await pause();
results.salaryDeleted = await data().then((value) => value.salaryProfiles.length === salaryCount);

await evaluate(`(()=>{const input=document.querySelector('input[aria-label="Custom fund name"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,'Audit fund');input.dispatchEvent(new Event('input',{bubbles:true}));[...document.querySelectorAll('.add-fund button')][0].click();return true})()`); await pause();
results.fundAdded = await data().then((value) => value.funds.some((item) => item.name === "Audit fund"));
await evaluate("document.querySelector('button[aria-label=\"Delete Audit fund\"]').click(); true"); await pause();
results.fundDeleted = await data().then((value) => !value.funds.some((item) => item.name === "Audit fund"));

await navigate("/forecast");
const beforeSimulation = await evaluate("document.querySelector('.forecast-summary article strong').textContent");
await evaluate("[...document.querySelectorAll('button')].find((button)=>button.textContent.includes('Simulate')).click(); true"); await pause();
await evaluate(`(()=>{const el=document.querySelector('input[aria-label="Simulation overtime hours"]');const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(el,'40');el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`); await pause();
const afterSimulation = await evaluate("document.querySelector('.forecast-summary article strong').textContent");
results.simulation = { panel: await evaluate("Boolean(document.querySelector('.simulation-panel'))"), before: beforeSimulation, after: afterSimulation, changed: beforeSimulation !== afterSimulation };

await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await navigate("/");
const mobileShot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("/private/tmp/flow-v12-mobile-full-audit.png", Buffer.from(mobileShot.data, "base64"));
results.mobile = await evaluate("JSON.stringify({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,navItems:document.querySelectorAll('.bottom-nav a').length,balanceRight:document.querySelector('.balance-card').getBoundingClientRect().right,savingsVisible:Boolean(document.querySelector('.savings-card'))})").then(JSON.parse);

console.log(JSON.stringify(results, null, 2));
socket.close();
