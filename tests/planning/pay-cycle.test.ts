import assert from "node:assert/strict";
import test from "node:test";
import { getAmexSummary, getCycleEntry, updateCurrentCycle } from "../../lib/engine";
import { demoData } from "../../lib/demo-data";
import type { FlowData } from "../../lib/types";

const data: FlowData = {
  ...demoData,
  transactions: [],
  salaryProfiles: demoData.salaryProfiles.map((profile) => ({ ...profile, payday: 25 })),
  funds: [
    { id: "income", name: "Income", kind: "income", balance: 9999, cycleEntries: {
      "2026-08": { income: 3000, fixed: 1200, savings: 500, lifestyle: 400 },
      "2026-12": { income: 2000, fixed: 2200, lifestyle: 100 },
    } },
    { id: "available", name: "Available", kind: "available", balance: 9999 },
  ],
};
const currentDate = new Date(2026, 8, 24, 23, 59);

test("cycle keeps recorded totals through the 24th, then starts at zero at midnight", () => {
  const previous = getCycleEntry(data, currentDate);
  assert.equal(previous.key, "2026-08");
  assert.equal(previous.available, 1300);
  assert.equal(previous.values.lifestyle, previous.available);
  const next = getCycleEntry(data, new Date(2026, 8, 25, 0, 0));
  assert.equal(next.key, "2026-09");
  assert.deepEqual(next.values, { income: 0, fixed: 0, savings: 0, lifestyle: 0 });
  assert.equal(next.available, 0);
  assert.equal(getCycleEntry(data, new Date(2026, 7, 25)).values.income, 3000);
});

test("legacy cycles default savings to zero and preserve deficits", () => {
  const cycle = getCycleEntry(data, new Date(2027, 0, 24));
  assert.equal(cycle.values.savings, 0);
  assert.equal(cycle.available, -200);
  assert.equal(cycle.values.lifestyle, -200);
  assert.equal(getCycleEntry(data, new Date(2027, 0, 25)).available, 0);
});

test("legacy monthly income is read only for its own cycle", () => {
  const legacy: FlowData = { ...data, funds: [{ id: "income", name: "Income", kind: "income", balance: 5000, monthlyBalances: { "2026-08": 1500 } }] };
  assert.equal(getCycleEntry(legacy, currentDate).available, 1500);
  assert.equal(getCycleEntry(legacy, new Date(2026, 8, 25)).available, 0);
});

test("income, fixed and savings changes recalculate lifestyle and available cash", () => {
  let updated = updateCurrentCycle(data, { income: 4000 }, currentDate);
  updated = updateCurrentCycle(updated, { fixed: 1500, savings: 900 }, currentDate);
  const cycle = getCycleEntry(updated, currentDate);
  assert.equal(cycle.available, 1600);
  assert.equal(cycle.values.lifestyle, 1600);
  assert.equal(cycle.overridden, false);
  assert.equal(data.funds[0].cycleEntries!["2026-08"].income, 3000);
});

test("override survives edits and reload, synchronizes lifestyle, and can be removed", () => {
  let updated = updateCurrentCycle(data, { availableOverride: 725.50 }, currentDate);
  updated = updateCurrentCycle(updated, { savings: 800 }, currentDate);
  updated = JSON.parse(JSON.stringify(updated)) as FlowData;
  const cycle = getCycleEntry(updated, currentDate);
  assert.equal(cycle.calculatedAvailable, 1000);
  assert.equal(cycle.available, 725.50);
  assert.equal(cycle.values.lifestyle, 725.50);
  assert.equal(cycle.overridden, true);
  const automatic = getCycleEntry(updateCurrentCycle(updated, { availableOverride: undefined }, currentDate), currentDate);
  assert.equal(automatic.available, 1000);
  assert.equal(automatic.values.lifestyle, 1000);
  assert.equal(automatic.overridden, false);
});

test("zero and negative overrides work and do not carry into the next cycle", () => {
  for (const amount of [0, -125.25]) {
    const updated = updateCurrentCycle(data, { availableOverride: amount }, currentDate);
    assert.equal(getCycleEntry(updated, currentDate).available, amount);
    assert.equal(getCycleEntry(updated, currentDate).values.lifestyle, amount);
    assert.equal(getCycleEntry(updated, currentDate).overridden, true);
    const next = getCycleEntry(updated, new Date(2026, 8, 25));
    assert.equal(next.available, 0);
    assert.equal(next.overridden, false);
    const entered = getCycleEntry(updateCurrentCycle(updated, { income: 2500 }, new Date(2026, 8, 25)), new Date(2026, 8, 25));
    assert.equal(entered.available, 2500);
    assert.equal(entered.values.savings, 0);
    assert.equal(getCycleEntry(updated, currentDate).available, amount);
  }
});

const expense = { id: "purchase", name: "Purchase", type: "expense" as const, date: "2026-09-20", amount: 100, fundId: "available", createdAt: "2026-09-20T12:00:00Z" };

test("posted cycle transactions adjust cash; EV, recurring, future, old and other funds do not", () => {
  const updated: FlowData = { ...data, transactions: [
    expense,
    { ...expense, id: "card", paymentMethod: "amex", amount: 50 },
    { ...expense, id: "ev", recurringBudgetId: "charging", amount: 30 },
    { ...expense, id: "fixed", recurrence: { frequency: "monthly", startDate: "2026-08-25" } },
    { ...expense, id: "future", date: "2026-09-25" },
    { ...expense, id: "old", date: "2026-08-24" },
    { ...expense, id: "savings", fundId: "savings" },
    { ...expense, id: "income", type: "income", amount: 40 },
    { ...expense, id: "out", type: "transfer", amount: 20, destinationFundId: "savings" },
    { ...expense, id: "in", type: "transfer", amount: 10, fundId: "savings", destinationFundId: "available" },
  ] };
  const cycle = getCycleEntry(updated, currentDate);
  assert.equal(cycle.transactionDelta, -70);
  assert.equal(cycle.available, 1230);
  assert.equal(cycle.values.lifestyle, cycle.available);
});

test("editing and deleting a transaction recalculates cash without duplicate deductions", () => {
  const withExpense = { ...data, transactions: [expense] };
  assert.equal(getCycleEntry(withExpense, currentDate).available, 1200);
  assert.equal(getCycleEntry({ ...withExpense, transactions: [{ ...expense, amount: 200 }] }, currentDate).available, 1100);
  assert.equal(getCycleEntry({ ...withExpense, transactions: [] }, currentDate).available, 1300);
  assert.equal(getCycleEntry({ ...withExpense, transactions: [{ ...expense, paymentMethod: "amex", amexReserved: true }] }, currentDate).available, 1200);
});

test("manual balance is exact when entered, then follows new activity across reloads", () => {
  const manual = updateCurrentCycle({ ...data, transactions: [expense] }, { availableOverride: 500 }, currentDate);
  assert.equal(getCycleEntry(manual, currentDate).available, 500);
  const updated = JSON.parse(JSON.stringify({ ...manual, transactions: [...manual.transactions, { ...expense, id: "new", amount: 25 }] })) as FlowData;
  assert.equal(getCycleEntry(updated, currentDate).available, 475);
  assert.equal(getCycleEntry(updateCurrentCycle(updated, { availableOverride: 600 }, currentDate), currentDate).available, 600);
  assert.equal(getCycleEntry(updateCurrentCycle(updated, { availableOverride: undefined }, currentDate), currentDate).available, 1175);
  assert.equal(getCycleEntry(updated, new Date(2026, 8, 25)).available, 0);
});


test("Amex affects post-reserve cash first and bank cash only when reserved, excluding EV", () => {
  const card: FlowData = { ...data, transactions: [
    { ...expense, paymentMethod: "amex", amount: 100 },
    { ...expense, id: "ev", paymentMethod: "amex", recurringBudgetId: "charging", amount: 30 },
  ] };
  const bank = getCycleEntry(card, currentDate).available;
  assert.equal(bank, 1300);
  assert.equal(getAmexSummary(card, currentDate).unreservedOutstanding, 100);
  assert.equal(bank - getAmexSummary(card, currentDate).unreservedOutstanding, 1200);
  const reserved: FlowData = { ...card, transactions: card.transactions.map((t) => ({ ...t, amexReserved: true })) };
  assert.equal(getCycleEntry(reserved, currentDate).available, 1200);
  assert.equal(getAmexSummary(reserved, currentDate).unreservedOutstanding, 0);
  const manual = updateCurrentCycle(card, { availableOverride: 500 }, currentDate);
  assert.equal(getCycleEntry(manual, currentDate).available, 500);
  assert.equal(getCycleEntry({ ...manual, transactions: reserved.transactions }, currentDate).available, 400);
});
