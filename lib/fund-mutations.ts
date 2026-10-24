import type { Fund, Transaction } from "./types";

export function applyFundDelta(fund: Fund, delta: number, accountId?: string) {
  if (fund.accounts === undefined) return { ...fund, balance: Math.round((fund.balance + delta) * 100) / 100 };
  const accounts = fund.accounts.length
    ? fund.accounts.map((account, index) => account.id === accountId || (!accountId && index === 0) ? { ...account, balance: Math.round((account.balance + delta) * 100) / 100 } : account)
    : [{ id: `${fund.id}-unallocated`, name: "Unallocated activity", balance: delta }];
  return { ...fund, accounts, balance: accounts.reduce((sum, account) => sum + account.balance, 0) };
}

export function applyTransactionToFunds(funds: Fund[], transaction: Transaction, direction: 1 | -1) {
  const currentDate = new Date().toISOString().slice(0, 10);
  if (transaction.type === "expense" && transaction.recurringBudgetId) return funds;
  if (transaction.type === "expense" && transaction.paymentMethod === "amex" && transaction.recurrence) {
    const reservedOccurrences = (transaction.recurrence.amexReservedDates ?? []).filter((date) => date <= currentDate).length;
    if (!reservedOccurrences) return funds;
    return funds.map((fund) => fund.id === transaction.fundId
      ? applyFundDelta(fund, -transaction.amount * reservedOccurrences * direction, transaction.fundAccountId)
      : fund);
  }
  if (transaction.recurrence || transaction.date > currentDate) return funds;
  return funds.map((fund) => {
    if (transaction.loan) return fund.id === transaction.fundId ? applyFundDelta(fund, transaction.amount * transaction.loan.direction * direction, transaction.fundAccountId) : fund;
    if (transaction.type === "expense" && fund.id === transaction.fundId) {
      if (transaction.paymentMethod === "amex" && !transaction.amexReserved) return fund;
      return applyFundDelta(fund, -transaction.amount * direction, transaction.fundAccountId);
    }
    if (transaction.type === "income" && fund.id === transaction.fundId) return applyFundDelta(fund, transaction.amount * direction, transaction.fundAccountId);
    if (transaction.type === "transfer" && fund.id === transaction.fundId) return applyFundDelta(fund, -transaction.amount * direction, transaction.fundAccountId);
    if (transaction.type === "transfer" && fund.id === transaction.destinationFundId) return applyFundDelta(fund, transaction.amount * direction, transaction.destinationFundAccountId);
    return fund;
  });
}

