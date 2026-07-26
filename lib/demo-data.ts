import type {
  Account,
  BudgetItem,
  Bucket,
  Receivable,
  RecurringItem,
  TaxFund,
  Transaction,
} from "@/lib/types";

// La modalità senza Supabase parte intenzionalmente vuota.
// I dati personali vengono creati dall'utente e conservati solo nel suo browser.
export const demoAccounts: Account[] = [];
export const demoTransactions: Transaction[] = [];
export const demoBudget: BudgetItem[] = [];
export const demoRecurring: RecurringItem[] = [];
export const demoTaxFunds: TaxFund[] = [];
export const demoReceivables: Receivable[] = [];
export const demoBuckets: Bucket[] = [];
