import assert from "node:assert/strict";
import test from "node:test";
import { getCycleEntry } from "../../lib/engine";
import { demoData } from "../../lib/demo-data";
import type { FlowData } from "../../lib/types";

const data: FlowData = {
  ...demoData,
  salaryProfiles: demoData.salaryProfiles.map((profile) => ({ ...profile, payday: 25 })),
  funds: [
    { id: "income", name: "Income", kind: "income", balance: 9999, cycleEntries: {
      "2026-08": { income: 3000, fixed: 1200, lifestyle: 400 },
      "2026-12": { income: 2000, fixed: 2200, lifestyle: 100 },
    } },
    { id: "available", name: "Available", kind: "available", balance: 9999 },
  ],
};

test("cycle keeps recorded totals through the 24th, then starts at zero at midnight", () => {
  const previous = getCycleEntry(data, new Date(2026, 8, 24, 23, 59));
  assert.equal(previous.key, "2026-08");
  assert.equal(previous.available, 1800);
  assert.equal(previous.remaining, 1400);
  const next = getCycleEntry(data, new Date(2026, 8, 25, 0, 0));
  assert.equal(next.key, "2026-09");
  assert.deepEqual(next.values, { income: 0, fixed: 0, lifestyle: 0 });
  assert.equal(next.available, 0);
  assert.equal(next.remaining, 0);
  assert.equal(getCycleEntry(data, new Date(2026, 7, 25)).values.income, 3000);
});

test("available cash uses only the current income minus fixed, including deficits", () => {
  const cycle = getCycleEntry(data, new Date(2027, 0, 24));
  assert.equal(cycle.available, -200);
  assert.equal(cycle.remaining, -300);
  assert.equal(getCycleEntry(data, new Date(2027, 0, 25)).available, 0);
});

test("legacy monthly income is read only for its own cycle", () => {
  const legacy: FlowData = { ...data, funds: [{ id: "income", name: "Income", kind: "income", balance: 5000, monthlyBalances: { "2026-08": 1500 } }] };
  assert.equal(getCycleEntry(legacy, new Date(2026, 8, 24)).available, 1500);
  assert.equal(getCycleEntry(legacy, new Date(2026, 8, 25)).available, 0);
});
