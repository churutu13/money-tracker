import { monthKey } from "./format";
import type { CycleEntry, FlowData, Recurrence, Transaction } from "./types";

const atNoon = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
const dateInMonth = (year: number, month: number, day: number) =>
  new Date(year, month, Math.min(Math.max(1, day), new Date(year, month + 1, 0).getDate()), 12);

export const getCycleStartDay = (data: FlowData) => data.salaryProfiles[0]?.payday ?? 25;

export function getFinancialCycle(date = new Date(), startDay = 25) {
  const current = atNoon(date);
  const thisMonthStart = dateInMonth(current.getFullYear(), current.getMonth(), startDay);
  const start = current >= thisMonthStart ? thisMonthStart : dateInMonth(current.getFullYear(), current.getMonth() - 1, startDay);
  const nextStart = dateInMonth(start.getFullYear(), start.getMonth() + 1, startDay);
  const end = new Date(nextStart);
  end.setDate(end.getDate() - 1);
  const startLabel = start.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
  const endLabel = end.toLocaleDateString("en-IE", { day: "numeric", month: "short" });
  return {
    key: monthKey(start),
    start,
    end,
    label: `${startLabel} – ${endLabel}`,
    longLabel: `${startLabel} – ${end.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}`,
  };
}

export function getFinancialCycleAtOffset(date: Date, startDay: number, offset: number) {
  const current = getFinancialCycle(date, startDay);
  return getFinancialCycle(dateInMonth(current.start.getFullYear(), current.start.getMonth() + offset, startDay), startDay);
}

export function recurrenceDatesInRange(recurrence: Recurrence, rangeStart: Date, rangeEnd: Date): Date[] {
  const start = new Date(`${recurrence.startDate}T12:00:00`);
  const end = recurrence.endDate ? new Date(`${recurrence.endDate}T12:00:00`) : null;
  const lower = atNoon(rangeStart);
  const upper = atNoon(rangeEnd);
  if (start > upper || (end && end < lower)) return [];

  if (recurrence.frequency === "weekly") {
    const intervalDays = 7 * Math.max(1, recurrence.interval ?? 1);
    const cursor = new Date(start);
    const dates: Date[] = [];
    let occurrenceIndex = 0;
    while (cursor <= upper && (!end || cursor <= end)) {
      if (recurrence.paymentCount && occurrenceIndex >= recurrence.paymentCount) break;
      if (cursor >= lower) dates.push(new Date(cursor));
      occurrenceIndex += 1;
      cursor.setDate(cursor.getDate() + intervalDays);
    }
    return dates;
  }

  const dates: Date[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12);
  let occurrenceIndex = 0;
  while (cursor <= upper) {
    const distance = (cursor.getFullYear() - start.getFullYear()) * 12 + cursor.getMonth() - start.getMonth();
    const eligible = recurrence.frequency === "yearly"
      ? cursor.getMonth() === start.getMonth()
      : recurrence.frequency === "custom"
        ? distance % Math.max(1, recurrence.interval ?? 1) === 0
        : true;
    if (eligible) {
      const due = dateInMonth(cursor.getFullYear(), cursor.getMonth(), recurrence.paymentDay ?? start.getDate());
      if (due >= start) {
        if (recurrence.paymentCount && occurrenceIndex >= recurrence.paymentCount) break;
        if ((!end || due <= end) && due >= lower && due <= upper) dates.push(due);
        occurrenceIndex += 1;
      }
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return dates;
}

export function recurrenceOccurrencesInMonth(recurrence: Recurrence, month: Date): number {
  return recurrenceDatesInRange(recurrence, new Date(month.getFullYear(), month.getMonth(), 1, 12), new Date(month.getFullYear(), month.getMonth() + 1, 0, 12)).length;
}

export function recursInMonth(recurrence: Recurrence, month: Date): boolean {
  return recurrenceOccurrencesInMonth(recurrence, month) > 0;
}

const emptyCycleEntry = (): CycleEntry => ({ income: 0, fixed: 0, lifestyle: 0 });

export function getCycleEntry(data: FlowData, date = new Date()) {
  const fund = data.funds.find((item) => item.kind === "income");
  const cycle = getFinancialCycle(date, getCycleStartDay(data));
  const entries = fund?.cycleEntries ?? {};
  const exact = entries[cycle.key];
  const legacyIncome = fund?.monthlyBalances?.[cycle.key];
  const values = exact ?? (legacyIncome !== undefined ? { ...emptyCycleEntry(), income: legacyIncome } : emptyCycleEntry());
  const source = exact ? "current" : legacyIncome !== undefined ? "legacy" : "empty";
  return {
    fund,
    cycle,
    key: cycle.key,
    values,
    inherited: false,
    source,
    sourceKey: exact ? cycle.key : undefined,
    available: values.income - values.fixed,
    remaining: values.income - values.fixed - values.lifestyle,
  };
}

export function getAmexCycle(date = new Date()) {
  const cycle = getFinancialCycle(date, 27);
  const dueDate = dateInMonth(cycle.end.getFullYear(), cycle.end.getMonth() + 1, 10);
  return { ...cycle, dueDate };
}

export interface AmexPurchase {
  id: string;
  transaction: Transaction;
  date: string;
  amount: number;
  reserved: boolean;
  recurring: boolean;
}

export function getAmexPurchases(data: FlowData, date = new Date()): AmexPurchase[] {
  const today = atNoon(date);

  return data.transactions.flatMap<AmexPurchase>((transaction) => {
    if (transaction.type !== "expense" || transaction.paymentMethod !== "amex") return [];
    if (!transaction.recurrence) {
      return [{
        id: transaction.id,
        transaction,
        date: transaction.date,
        amount: transaction.amount,
        reserved: Boolean(transaction.amexReserved),
        recurring: false,
      }];
    }

    const scheduledDates = recurrenceDatesInRange(
      transaction.recurrence,
      new Date(`${transaction.recurrence.startDate}T12:00:00`),
      today,
    ).map((occurrence) => occurrence.toISOString().slice(0, 10));
    const historicalReservedDates = (transaction.recurrence.amexReservedDates ?? []).filter((reservedDate) => reservedDate <= today.toISOString().slice(0, 10));
    const occurrenceDates = [...new Set([...scheduledDates, ...historicalReservedDates])].sort();
    const reservedDates = new Set(transaction.recurrence.amexReservedDates ?? []);

    return occurrenceDates.map((occurrenceDate) => ({
      id: `${transaction.id}:${occurrenceDate}`,
      transaction,
      date: occurrenceDate,
      amount: transaction.amount,
      reserved: reservedDates.has(occurrenceDate),
      recurring: true,
    }));
  });
}

export function getAmexSummary(data: FlowData, date = new Date()) {
  const cycle = getAmexCycle(date);
  const purchases = getAmexPurchases(data);
  const current = purchases.filter((transaction) => {
    const transactionDate = new Date(`${transaction.date}T12:00:00`);
    return transactionDate >= cycle.start && transactionDate <= cycle.end;
  });
  const total = current.reduce((sum, transaction) => sum + transaction.amount, 0);
  const reserved = current.reduce((sum, transaction) => sum + (transaction.reserved ? transaction.amount : 0), 0);
  const today = atNoon(date);
  const unreservedOutstanding = purchases.reduce((sum, transaction) => {
    const transactionDate = new Date(`${transaction.date}T12:00:00`);
    return !transaction.reserved && !transaction.transaction.recurringBudgetId && transactionDate <= today
      ? sum + transaction.amount
      : sum;
  }, 0);
  return { cycle, purchases: current, total, reserved, toReserve: total - reserved, unreservedOutstanding };
}

export function getRecurringStatus(transaction: Transaction, data: FlowData, date = new Date()) {
  if (!transaction.recurrence) return null;
  const cycle = getFinancialCycle(date, getCycleStartDay(data));
  const occurrences = recurrenceDatesInRange(transaction.recurrence, cycle.start, cycle.end);
  const today = atNoon(date);
  return occurrences.some((occurrence) => occurrence <= today) ? "passed" : "upcoming";
}

export function getRecurringBudgetProgress(data: FlowData, budget: Transaction, date = new Date()) {
  const cycle = getFinancialCycle(date, getCycleStartDay(data));
  const today = atNoon(date);
  const occurrences = budget.recurrence
    ? recurrenceDatesInRange(budget.recurrence, cycle.start, cycle.end)
    : [];
  const planned = budget.amount * occurrences.length;
  const linkedTransactions = data.transactions.filter((transaction) => {
    if (transaction.type !== "expense" || transaction.recurrence || transaction.recurringBudgetId !== budget.id) return false;
    const transactionDate = new Date(`${transaction.date}T12:00:00`);
    return transactionDate >= cycle.start && transactionDate <= cycle.end && transactionDate <= today;
  });
  const spent = linkedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  return {
    budget,
    cycle,
    planned,
    spent,
    remaining: Math.max(0, planned - spent),
    over: Math.max(0, spent - planned),
    linkedTransactions,
  };
}

export function getRecurringCycleSummary(data: FlowData, date = new Date()) {
  const cycle = getFinancialCycle(date, getCycleStartDay(data));
  const today = atNoon(date);
  return data.transactions.reduce((summary, transaction) => {
    if (transaction.type !== "expense" || !transaction.recurrence) return summary;
    const occurrences = recurrenceDatesInRange(transaction.recurrence, cycle.start, cycle.end);
    const planned = transaction.amount * occurrences.length;
    if (transaction.recurrence.spendingBudget) {
      const progress = getRecurringBudgetProgress(data, transaction, date);
      return {
        planned: summary.planned + planned,
        remaining: summary.remaining + progress.remaining,
        budgetSpent: summary.budgetSpent + progress.spent,
      };
    }
    const upcoming = occurrences.filter((occurrence) => occurrence > today).length * transaction.amount;
    return { ...summary, planned: summary.planned + planned, remaining: summary.remaining + upcoming };
  }, { planned: 0, remaining: 0, budgetSpent: 0 });
}
