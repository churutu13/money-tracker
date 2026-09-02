import { writeFile } from "node:fs/promises";

const port = process.env.FLOW_AUDIT_CDP_PORT ?? "9335";
const baseUrl = process.env.FLOW_AUDIT_BASE_URL ?? "http://localhost:3001";
const pages = await fetch(`http://127.0.0.1:${port}/json`).then((response) => response.json());
const page = pages.find((item) => item.type === "page");
if (!page) throw new Error("No Chrome page target found");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 0;
const pending = new Map();
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  const request = pending.get(message.id);
  if (!request) return;
  pending.delete(message.id);
  if (message.error) request.reject(new Error(message.error.message));
  else request.resolve(message.result);
});

const call = (method, params = {}) => {
  const id = ++nextId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
};
const evaluate = async (expression) => {
  const result = await call("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const pause = (milliseconds = 500) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const navigate = async (path) => {
  await call("Page.navigate", { url: `${baseUrl}${path}` });
  await pause(900);
};
const setInput = (selector, value) => evaluate(`(() => {
  const input = document.querySelector(${JSON.stringify(selector)});
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, ${JSON.stringify(value)});
  input.dispatchEvent(new Event('input', { bubbles: true }));
  return input.value;
})()`);
const selectValue = (selector, value) => evaluate(`(() => {
  const select = document.querySelector(${JSON.stringify(selector)});
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set;
  setter.call(select, ${JSON.stringify(value)});
  select.dispatchEvent(new Event('change', { bubbles: true }));
  return select.value;
})()`);
const readData = () => evaluate("localStorage.getItem('flow.cash-planner.v8')").then(JSON.parse);
const screenshot = async (path) => {
  const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path, Buffer.from(result.data, "base64"));
};

await call("Runtime.enable");
await call("Page.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
await evaluate(`(async () => {
  localStorage.clear();
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
  return true;
})()`);
await call("Page.reload", { ignoreCache: true });
await pause(1000);

const results = {};
const initial = await readData();
results.migration = {
  chargingIsBudget: initial.transactions.find((transaction) => transaction.id === "charging")?.recurrence?.spendingBudget,
};

await navigate("/amex");
await evaluate("document.querySelector('[data-testid=\"add-transaction\"]').click(); true");
await pause();
results.form = {
  paymentMethod: await evaluate("document.querySelector('select[aria-label=\"Payment method\"]').value"),
  budgetOptions: await evaluate("[...document.querySelector('select[aria-label=\"Recurring budget\"]').options].map((option) => option.textContent)"),
};
await setInput("input[aria-label=\"Amount\"]", "40");
await setInput("input[placeholder=\"What is it?\"]", "QA Amex charging");
await selectValue("select[aria-label=\"Recurring budget\"]", "charging");
results.form.autoName = await evaluate("document.querySelector('input[placeholder=\"What is it?\"]').value");
await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();

const afterAdd = await readData();
const added = afterAdd.transactions.find((transaction) => transaction.name === "Ricarica" && transaction.amount === 40 && transaction.paymentMethod === "amex");
results.afterAdd = {
  name: added?.name,
  paymentMethod: added?.paymentMethod,
  recurringBudgetId: added?.recurringBudgetId,
  amexReserved: added?.amexReserved,
  available: afterAdd.funds.find((fund) => fund.kind === "available")?.balance,
};

await navigate("/transactions");
await evaluate("[...document.querySelectorAll('.transaction-chips button')].find((button) => button.textContent.trim() === 'Recurring').click(); true");
await pause();
const chargingRow = "[...document.querySelectorAll('.transaction-item')].find((item) => item.textContent.includes('EV charging'))";
results.recurring = {
  summary: await evaluate("[...document.querySelectorAll('.recurring-cycle-summary strong')].map((item) => item.textContent)"),
  row: await evaluate(`${chargingRow}.textContent.replace(/\\s+/g, ' ').trim()`),
};
await evaluate(`${chargingRow}.scrollIntoView({ block: 'center' }); true`);
await pause();
await screenshot("/private/tmp/flow-v18-recurring-budget.png");

await navigate("/amex");
results.amexBeforeReserve = {
  statement: await evaluate("document.querySelector('.amex-statement-copy > strong').textContent"),
  rowPresent: await evaluate("[...document.querySelectorAll('.amex-row')].some((row) => row.textContent.includes('Ricarica'))"),
  effectiveAvailable: await evaluate("document.querySelector('.amex-available strong').textContent"),
};
await evaluate("[...document.querySelectorAll('.amex-row')].find((row) => row.textContent.includes('Ricarica')).querySelector('.amex-check').click(); true");
await pause(900);
const afterReserve = await readData();
const reserved = afterReserve.transactions.find((transaction) => transaction.name === "Ricarica" && transaction.amount === 40 && transaction.paymentMethod === "amex");
results.amexAfterReserve = {
  reserved: reserved?.amexReserved,
  recurringBudgetId: reserved?.recurringBudgetId,
  available: afterReserve.funds.find((fund) => fund.kind === "available")?.balance,
  statement: await evaluate("document.querySelector('.amex-statement-copy > strong').textContent"),
  setAside: await evaluate("document.querySelectorAll('.amex-overview article')[1].querySelector('strong').textContent"),
};
await evaluate("[...document.querySelectorAll('.amex-row')].find((row) => row.textContent.includes('Ricarica')).querySelector('.amex-check').click(); true");
await pause(900);
const afterUnreserve = await readData();
results.amexAfterUnreserve = {
  reserved: afterUnreserve.transactions.find((transaction) => transaction.name === "Ricarica" && transaction.amount === 40 && transaction.paymentMethod === "amex")?.amexReserved,
  available: afterUnreserve.funds.find((fund) => fund.kind === "available")?.balance,
  effectiveAvailable: await evaluate("document.querySelector('.amex-available strong').textContent"),
  setAside: await evaluate("document.querySelectorAll('.amex-overview article')[1].querySelector('strong').textContent"),
};

await navigate("/transactions");
await evaluate("[...document.querySelectorAll('.transaction-chips button')].find((button) => button.textContent.trim() === 'Recurring').click(); true");
await pause();
results.budgetAfterAmexReserve = await evaluate(`${chargingRow}.textContent.replace(/\\s+/g, ' ').trim()`);

await evaluate(`(() => {
  const legacy = JSON.parse(localStorage.getItem('flow.cash-planner.v8'));
  delete legacy.schemaVersion;
  const available = legacy.funds.find((fund) => fund.kind === 'available');
  available.balance = 560;
  const linked = legacy.transactions.find((transaction) => transaction.name === 'Ricarica' && transaction.amount === 40);
  linked.paymentMethod = 'bank';
  linked.amexReserved = false;
  localStorage.setItem('flow.cash-planner.v7', JSON.stringify(legacy));
  localStorage.removeItem('flow.cash-planner.v8');
  return true;
})()`);
await call("Page.reload", { ignoreCache: true });
await pause(1000);
const afterMigration = await readData();
results.legacyFundRepair = {
  schemaVersion: afterMigration.schemaVersion,
  available: afterMigration.funds.find((fund) => fund.kind === "available")?.balance,
};

await evaluate("document.querySelector('[data-testid=\"add-transaction\"]').click(); true");
await pause();
await setInput("input[aria-label=\"Amount\"]", "25");
await setInput("input[placeholder=\"What is it?\"]", "QA Bank charging");
await selectValue("select[aria-label=\"Recurring budget\"]", "charging");
await evaluate("document.querySelector('.transaction-form').requestSubmit(); true");
await pause();
const afterBankCharge = await readData();
results.bankBudgetCharge = {
  available: afterBankCharge.funds.find((fund) => fund.kind === "available")?.balance,
  name: afterBankCharge.transactions.find((transaction) => transaction.name === "Ricarica" && transaction.amount === 25)?.name,
  linked: afterBankCharge.transactions.find((transaction) => transaction.name === "Ricarica" && transaction.amount === 25)?.recurringBudgetId,
};

console.log(JSON.stringify(results, null, 2));
socket.close();
