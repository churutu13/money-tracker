import { writeFile } from "node:fs/promises";

const port = process.env.FLOW_AUDIT_CDP_PORT ?? "9228";
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
const pause = (milliseconds = 350) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const navigate = async (path) => {
  await call("Page.navigate", { url: `http://127.0.0.1:3000${path}` });
  await pause(850);
};
const setInput = (selector, value) => evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});if(!input)throw new Error('Missing input');input.focus();const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;setter.call(input,${JSON.stringify(value)});input.dispatchEvent(new Event('input',{bubbles:true}));return input.value})()`);

await call("Runtime.enable");
await call("Page.enable");
await call("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate("localStorage.clear(); true");
await call("Page.reload", { ignoreCache: true });
await pause(900);

const initial = JSON.parse(await evaluate("JSON.stringify(JSON.parse(localStorage.getItem('flow.cash-planner.v5')))"));
await setInput(".income-entry input", "3200");
await pause();
const afterIncome = JSON.parse(await evaluate("JSON.stringify(JSON.parse(localStorage.getItem('flow.cash-planner.v5')))"));
const currentKey = Object.keys(afterIncome.funds.find((fund) => fund.kind === "income").monthlyBalances)[0];

const results = {
  migration: {
    v5Created: Boolean(initial),
    savings: initial.funds.find((fund) => fund.kind === "savings")?.balance,
  },
  cycle: {
    label: await evaluate("document.querySelector('.income-ledger header strong').textContent"),
    sectionLabel: await evaluate("document.querySelector('.month-section .month-pill').textContent"),
    incomeKey: currentKey,
    received: afterIncome.funds.find((fund) => fund.kind === "income")?.monthlyBalances?.[currentKey],
    stats: await evaluate("[...document.querySelectorAll('.income-stat strong')].map((item)=>item.textContent)"),
    upcoming: await evaluate("document.querySelector('.income-remaining small').textContent"),
    upcomingDates: await evaluate("[...document.querySelectorAll('.upcoming-list .transaction-date')].map((item)=>item.textContent.trim())"),
    inputFont: await evaluate("getComputedStyle(document.querySelector('.income-entry input')).fontSize"),
    noHorizontalOverflow: await evaluate("document.documentElement.scrollWidth===innerWidth"),
  },
};

const mockDate = async (iso) => call("Page.addScriptToEvaluateOnNewDocument", { source: `{
  const NativeDate = Date;
  const fixed = ${JSON.stringify(iso)};
  globalThis.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [fixed])); }
    static now() { return new NativeDate(fixed).getTime(); }
  };
}` });
const readCycle = () => evaluate(`JSON.stringify({
  label:document.querySelector('.income-ledger header strong').textContent,
  stats:[...document.querySelectorAll('.income-stat strong')].map((item)=>item.textContent),
  upcoming:document.querySelector('.income-remaining small').textContent
})`).then(JSON.parse);

const beforeBoundary = await mockDate("2026-09-24T12:00:00+02:00");
await call("Page.reload", { ignoreCache: true });
await pause(900);
results.september24 = await readCycle();
await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: beforeBoundary.identifier });

const afterBoundary = await mockDate("2026-09-25T12:00:00+02:00");
await call("Page.reload", { ignoreCache: true });
await pause(900);
results.september25 = await readCycle();
await call("Page.removeScriptToEvaluateOnNewDocument", { identifier: afterBoundary.identifier });
await call("Page.reload", { ignoreCache: true });
await pause(900);

await navigate("/transactions");
results.transactionGroups = await evaluate("[...document.querySelectorAll('.timeline-heading h2')].map((item)=>item.textContent)");
await navigate("/settings");
results.paydayCopy = await evaluate("[...document.querySelectorAll('.setting-row')].find((row)=>row.textContent.includes('Payday'))?.textContent");
await navigate("/");
await evaluate("document.querySelector('.income-ledger').scrollIntoView({block:'center'}); true");
await pause();
const screenshot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
await writeFile("/private/tmp/flow-v14-pay-cycle-mobile.png", Buffer.from(screenshot.data, "base64"));

console.log(JSON.stringify(results, null, 2));
socket.close();
