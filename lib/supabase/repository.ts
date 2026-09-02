import type { SupabaseClient } from "@supabase/supabase-js";
import type { FlowData, Transaction } from "@/lib/types";

/**
 * Persistence boundary for production sync. The app is local-first today; these
 * functions intentionally accept/return domain objects so Quick Add and future
 * importers can insert parsed transactions through the same path as the form.
 */
export async function upsertTransaction(client: SupabaseClient, transaction: Transaction) {
  const { recurrence, createdAt, expenseKind, paymentMethod, amexReserved, recurringBudgetId, fundId, fundAccountId, destinationFundId, destinationFundAccountId, ...base } = transaction;
  const { error } = await client.from("transactions").upsert({
    ...base,
    fund_id: fundId,
    fund_account_id: fundAccountId ?? null,
    destination_fund_id: destinationFundId ?? null,
    destination_fund_account_id: destinationFundAccountId ?? null,
    expense_kind: expenseKind ?? null,
    payment_method: paymentMethod ?? null,
    amex_reserved: amexReserved ?? false,
    recurring_budget_id: recurringBudgetId ?? null,
    recurrence: recurrence ?? null,
    created_at: createdAt,
  });
  if (error) throw error;
}

export async function loadWorkspace(client: SupabaseClient, userId: string): Promise<Partial<FlowData>> {
  const [funds, fundAccounts, transactions, salaries, settings] = await Promise.all([
    client.from("funds").select("*").eq("user_id", userId),
    client.from("fund_accounts").select("*").eq("user_id", userId),
    client.from("transactions").select("*").eq("user_id", userId),
    client.from("salary_profiles").select("*").eq("user_id", userId),
    client.from("user_settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);
  const firstError = [funds, fundAccounts, transactions, salaries, settings].find((result) => result.error)?.error;
  if (firstError) throw firstError;
  const fundsWithAccounts = (funds.data ?? []).map((fund) => ({
    ...fund,
    monthlyBalances: fund.monthly_balances ?? {},
    cycleEntries: fund.cycle_entries ?? {},
    accounts: (fundAccounts.data ?? []).filter((account) => account.fund_id === fund.id).map((account) => ({ id: account.id, name: account.name, balance: Number(account.balance) })),
  }));
  const mappedTransactions = (transactions.data ?? []).map((transaction) => ({
    id: transaction.id,
    name: transaction.name,
    amount: Number(transaction.amount),
    type: transaction.type,
    date: transaction.date,
    category: transaction.category ?? undefined,
    notes: transaction.notes ?? undefined,
    fundId: transaction.fund_id,
    fundAccountId: transaction.fund_account_id ?? undefined,
    destinationFundId: transaction.destination_fund_id ?? undefined,
    destinationFundAccountId: transaction.destination_fund_account_id ?? undefined,
    expenseKind: transaction.expense_kind ?? undefined,
    paymentMethod: transaction.payment_method ?? undefined,
    amexReserved: transaction.amex_reserved ?? false,
    recurringBudgetId: transaction.recurring_budget_id ?? undefined,
    recurrence: transaction.recurrence ?? undefined,
    createdAt: transaction.created_at,
  }));
  return { funds: fundsWithAccounts, transactions: mappedTransactions, salaryProfiles: salaries.data ?? [], settings: settings.data ?? undefined } as Partial<FlowData>;
}
