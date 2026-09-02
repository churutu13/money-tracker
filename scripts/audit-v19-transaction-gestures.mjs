import { writeFile } from "node:fs/promises";

const pages = await fetch("http://127.0.0.1:9336/json").then((response) => response.json());
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
  const result = await call("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  return result.result.value;
};
const pause = (milliseconds = 450) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const activeFilter = () => evaluate("[...document.querySelectorAll('.transaction-chips button')].find((button) => button.getAttribute('aria-pressed') === 'true')?.textContent.trim()");
const touch = (type, x, y) => call("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y }], modifiers: 0 });
const swipe = async (fromX, toX, y) => {
  await touch("touchStart", fromX, y);
  await pause(70);
  await touch("touchMove", (fromX + toX) / 2, y);
  await pause(70);
  await touch("touchMove", toX, y);
  await touch("touchEnd", toX, y);
  await pause(500);
};
const longPress = async (x, y) => {
  await touch("touchStart", x, y);
  await pause(650);
  await touch("touchEnd", x, y);
  await pause(250);
};
const screenshot = async (path) => {
  const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  await writeFile(path, Buffer.from(shot.data, "base64"));
};

await call("Runtime.enable");
await call("Page.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 900, deviceScaleFactor: 1, mobile: true });
await call("Emulation.setTouchEmulationEnabled", { enabled: true, maxTouchPoints: 1 });
await evaluate(`(async () => {
  localStorage.clear();
  const registrations = await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.map((registration) => registration.unregister()));
  const names = await caches.keys();
  await Promise.all(names.map((name) => caches.delete(name)));
  return true;
})()`);
await call("Page.reload", { ignoreCache: true });
await pause(1100);
await evaluate(`(() => {
  const data = JSON.parse(localStorage.getItem('flow.cash-planner.v8'));
  data.transactions.unshift({
    id: 'qa-ev-charge', name: 'QA EV charge', amount: 40, type: 'expense',
    date: new Date().toISOString().slice(0, 10), fundId: 'available',
    expenseKind: 'variable', paymentMethod: 'amex', amexReserved: false,
    recurringBudgetId: 'charging', createdAt: new Date().toISOString()
  });
  localStorage.setItem('flow.cash-planner.v8', JSON.stringify(data));
  return true;
})()`);
await call("Page.reload", { ignoreCache: true });
await pause(1000);

const results = { filters: [await activeFilter()] };
const swipeArea = await evaluate(`(() => { const rect = document.querySelector('.transactions-swipe-area').getBoundingClientRect(); return { y: Math.min(innerHeight - 150, Math.max(250, rect.top + 120)) }; })()`);
await swipe(60, 330, swipeArea.y);
results.filters.push(await activeFilter());
await swipe(330, 60, swipeArea.y);
results.filters.push(await activeFilter());
await swipe(330, 60, swipeArea.y);
results.filters.push(await activeFilter());
await swipe(330, 60, swipeArea.y);
results.filters.push(await activeFilter());
results.evHero = {
  available: await evaluate("document.querySelector('.ev-charging-summary > strong').textContent"),
  split: await evaluate("[...document.querySelectorAll('.ev-charging-summary .available-split strong')].map((item) => item.textContent)"),
};
await screenshot("/private/tmp/flow-v19-ev-filter.png");
await swipe(60, 330, swipeArea.y);
results.filters.push(await activeFilter());
await swipe(330, 60, swipeArea.y);
results.filters.push(await activeFilter());

await swipe(60, 330, swipeArea.y);
results.filters.push(await activeFilter());
await swipe(60, 330, swipeArea.y);
results.filters.push(await activeFilter());
results.longPressFilter = await activeFilter();
await evaluate("[...document.querySelectorAll('.transaction-item')].find((item) => item.textContent.includes('QA EV charge')).scrollIntoView({ block: 'center' }); true");
await pause();
const rowCenter = await evaluate(`(() => { const rect = [...document.querySelectorAll('.transaction-item')].find((item) => item.textContent.includes('QA EV charge')).getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + Math.min(32, rect.height / 2) }; })()`);
await evaluate(`(() => { window.__gestureEvents = []; const area = document.querySelector('.transactions-swipe-area'); ['pointerdown','pointerup','pointercancel','touchstart','touchend','touchcancel'].forEach((type) => area.addEventListener(type, (event) => window.__gestureEvents.push({ type, target: event.target.className?.toString?.() ?? event.target.tagName }), true)); return true; })()`);
await longPress(rowCenter.x, rowCenter.y);
results.longPress = {
  menu: await evaluate("Boolean(document.querySelector('.expense-action-menu'))"),
  actions: await evaluate("[...document.querySelectorAll('.expense-action-menu > div button')].map((button) => button.textContent.trim())"),
  selectedText: await evaluate("window.getSelection().toString()"),
  swipeUserSelect: await evaluate("getComputedStyle(document.querySelector('.transactions-swipe-area')).userSelect"),
  menuUserSelect: await evaluate("document.querySelector('.expense-action-menu') ? getComputedStyle(document.querySelector('.expense-action-menu')).userSelect : null"),
  events: await evaluate("window.__gestureEvents"),
};
await screenshot("/private/tmp/flow-v19-long-press.png");
if (!results.longPress.menu) {
  console.log(JSON.stringify(results, null, 2));
  socket.close();
  process.exit(1);
}
await evaluate("[...document.querySelectorAll('.expense-action-menu > div button')].find((button) => button.textContent.includes('Edit')).click(); true");
await pause();
results.edit = {
  sheetOpen: await evaluate("document.querySelector('.sheet-layer').classList.contains('open')"),
  name: await evaluate("document.querySelector('input[placeholder=\"What is it?\"]').value"),
};
await evaluate("document.querySelector('.sheet-header .icon-button').click(); true");
await pause();
await longPress(rowCenter.x, rowCenter.y);
await evaluate("[...document.querySelectorAll('.expense-action-menu > div button')].find((button) => button.textContent.includes('Delete')).click(); true");
await pause();
results.delete = {
  confirmationVisible: await evaluate("Boolean(document.querySelector('.flow-dialog[role=\"alertdialog\"]'))"),
  confirmationTitle: await evaluate("document.querySelector('.flow-dialog[role=\"alertdialog\"] h2')?.textContent"),
};
await evaluate("document.querySelector('.flow-dialog[role=\"alertdialog\"] .secondary-button').click(); true");

console.log(JSON.stringify(results, null, 2));
socket.close();
