import assert from "node:assert/strict";
import test from "node:test";
import { demoData } from "../../lib/demo-data";
import { getAmexCycle, getCycleEntry, getPayCycle, getRecurringBudgetProgress, restartPayCycle, undoPayCycleRestart, updateCurrentCycle } from "../../lib/engine";
import type { FlowData, Transaction } from "../../lib/types";

function fixture(): FlowData {
  return {
    ...structuredClone(demoData),
    transactions: [],
    salaryProfiles: [{ ...structuredClone(demoData.salaryProfiles[0]), payday: 25, monthlyOvertime: { "2026-08": { hours: 8 }, "2026-09": { hours: 12, usableOverride: 150 } } }],
    funds: [
      { id: "income", name: "Income", kind: "income", balance: 0, cycleEntries: {
        "2026-08": { income: 3000, fixed: 1200, savings: 500, lifestyle: 1300 },
        "2026-09": { income: 3200, fixed: 1400, savings: 600, lifestyle: 1200, availableOverride: 700, overrideTransactionBaseline: -50 },
      } },
      { id: "available", name: "Available", kind: "available", balance: 700 },
      { id: "tax", name: "Tax", kind: "tax", balance: 7600 },
      { id: "savings", name: "Savings", kind: "savings", balance: 5000 },
    ],
  };
}
const expense = (id: string, date: string, amount = 50): Transaction => ({ id, date, amount, name: "Purchase", type: "expense", fundId: "available", createdAt: `${date}T08:00:00Z` });
const day = (date: Date) => date.toLocaleDateString("sv-SE");

test("early reset starts today and survives the normal payday without a second reset", () => {
  const original = fixture();
  const date = new Date(2026, 8, 23);
  let next = restartPayCycle(original, date);
  const cycle = getCycleEntry(next, date);
  assert.equal(cycle.key, "2026-09");
  assert.equal(day(cycle.cycle.start), "2026-09-23");
  assert.equal(day(cycle.cycle.end), "2026-10-24");
  assert.equal(cycle.available, 0);
  assert.deepEqual(cycle.values, { income: 0, fixed: 0, savings: 0, lifestyle: 0 });
  assert.equal(cycle.overridden, false);
  assert.deepEqual(next.salaryProfiles[0].monthlyOvertime![cycle.key], { hours: 0 });
  next = updateCurrentCycle(next, { income: 2800, fixed: 1000, savings: 500 }, date);
  assert.equal(getCycleEntry(next, new Date(2026, 8, 25)).available, 1300);
  assert.equal(getCycleEntry(next, new Date(2026, 9, 24)).available, 1300);
  assert.equal(getCycleEntry(next, new Date(2026, 9, 25)).available, 0);
  assert.equal(day(getPayCycle(next, new Date(2026, 9, 25)).start), "2026-10-25");
  assert.deepEqual(next.funds[0].cycleEntries!["2026-08"], original.funds[0].cycleEntries!["2026-08"]);
  assert.deepEqual(original.salaryProfiles[0].monthlyOvertime!["2026-09"], { hours: 12, usableOverride: 150 });
});

test("late reset clears totals and manual cash override without touching real funds or transactions", () => {
  const original = fixture();
  original.transactions = [expense("before", "2026-09-26"), expense("same-day", "2026-09-27")];
  const date = new Date(2026, 8, 27);
  const next = restartPayCycle(original, date);
  const cycle = getCycleEntry(next, date);
  assert.equal(day(cycle.cycle.start), "2026-09-27");
  assert.equal(day(cycle.cycle.end), "2026-10-24");
  assert.equal(cycle.transactionDelta, 0);
  assert.equal(cycle.available, 0);
  assert.equal(cycle.overridden, false);
  assert.deepEqual(next.transactions, original.transactions);
  assert.deepEqual(next.funds.slice(1), original.funds.slice(1));
  assert.equal(getPayCycle(next, new Date(2026, 8, 26)).key, "2026-08");
  const newActivity = { ...next, transactions: [...next.transactions, expense("after-reset", "2026-09-27", 20)] };
  assert.equal(getCycleEntry(newActivity, date).available, -20);
});

test("reset is idempotent, survives persistence, and undo restores saved totals and overtime", () => {
  const original = fixture();
  const date = new Date(2026, 8, 27);
  let next = restartPayCycle(original, date);
  next = updateCurrentCycle(next, { income: 4000 }, date);
  const persisted = JSON.parse(JSON.stringify(next)) as FlowData;
  assert.equal(getCycleEntry(persisted, date).available, 4000);
  assert.equal(restartPayCycle(persisted, date), persisted);
  assert.equal(restartPayCycle(persisted, new Date(2026, 8, 28)), persisted);
  const restored = undoPayCycleRestart(persisted, date);
  assert.deepEqual(restored.funds[0].cycleEntries, original.funds[0].cycleEntries);
  assert.deepEqual(restored.salaryProfiles, original.salaryProfiles);
  assert.deepEqual(restored.transactions, original.transactions);
  assert.equal(day(getPayCycle(restored, date).start), "2026-09-25");
});

test("undo of early reset removes a newly created entry and restores legacy fallback", () => {
  const original = fixture();
  original.funds[0].cycleEntries = { "2026-08": original.funds[0].cycleEntries!["2026-08"] };
  original.funds[0].monthlyBalances = { "2026-09": 2600 };
  const date = new Date(2026, 8, 23);
  const restored = undoPayCycleRestart(restartPayCycle(original, date), date);
  assert.equal(getCycleEntry(restored, date).key, "2026-08");
  assert.equal(getCycleEntry(restored, new Date(2026, 8, 25)).available, 2600);
  assert.deepEqual(restored.funds[0].cycleEntries, original.funds[0].cycleEntries);
});

test("December reset rolls into January; subsequent month can reset independently", () => {
  let next = restartPayCycle(fixture(), new Date(2026, 11, 24));
  assert.equal(day(getPayCycle(next, new Date(2027, 0, 23)).end), "2027-01-24");
  next = restartPayCycle(next, new Date(2027, 0, 23));
  assert.equal(getCycleEntry(next, new Date(2027, 0, 25)).key, "2027-01");
  assert.equal(day(getPayCycle(next, new Date(2027, 0, 25)).start), "2027-01-23");
  assert.equal(day(getPayCycle(next, new Date(2027, 0, 25)).end), "2027-02-24");
  assert.equal(day(getAmexCycle(new Date(2027, 0, 25)).start), "2026-12-27");
});

test("recurring budget uses adjusted cycle and ignores same-day purchases preceding reset", () => {
  const original = fixture();
  const budget: Transaction = { ...expense("budget", "2026-09-25", 100), recurrence: { frequency: "monthly", startDate: "2026-09-25", spendingBudget: true } };
  original.transactions = [budget, { ...expense("old-charge", "2026-09-27", 40), recurringBudgetId: "budget" }];
  const date = new Date(2026, 8, 27);
  const next = restartPayCycle(original, date);
  assert.equal(getRecurringBudgetProgress(next, budget, date).spent, 0);
  const added = { ...next, transactions: [...next.transactions, { ...expense("new-charge", "2026-09-27", 20), recurringBudgetId: "budget" }] };
  assert.equal(getRecurringBudgetProgress(added, budget, date).spent, 20);
  assert.equal(getRecurringBudgetProgress(added, budget, date).planned, 100);
  assert.equal(getRecurringBudgetProgress(added, budget, date).remaining, 80);
});
