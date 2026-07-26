import type { Currency } from "@/lib/utils";

export type AccountType =
  | "checking"
  | "cash"
  | "savings"
  | "investment"
  | "credit_card"
  | "tax";

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  currency: Currency;
  current_balance: number;
  initial_balance: number;
  include_in_liquidity: boolean;
  icon?: string | null;
  notes?: string | null;
  updated_at?: string;
}

export type TransactionType =
  | "income"
  | "expense"
  | "transfer"
  | "refund_received"
  | "refund_paid"
  | "allocation"
  | "disinvestment"
  | "investment"
  | "credit_card_payment";

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  currency: Currency;
  transaction_date: string;
  type: TransactionType;
  category_id?: string | null;
  source_account_id?: string | null;
  destination_account_id?: string | null;
  credit_card_id?: string | null;
  budget_item_id?: string | null;
  person?: string | null;
  notes?: string | null;
  created_at?: string;
}

export type BudgetStatus =
  | "planned"
  | "due"
  | "paid"
  | "postponed"
  | "cancelled"
  | "partial";

export interface BudgetItem {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  direction: "income" | "expense";
  status: BudgetStatus;
  frequency: "once" | "monthly" | "weekly" | "yearly" | "custom";
  expected_date?: string | null;
  paid_date?: string | null;
  account_id?: string | null;
  credit_card_id?: string | null;
  notes?: string | null;
  is_estimate?: boolean;
  rollover?: boolean;
  tag_names?: string[];
}

export interface TaxFund {
  id: string;
  name: string;
  reference_period: string;
  expected_amount: number;
  allocated_amount: number;
  currency: Currency;
  status: "to_allocate" | "partial" | "allocated" | "used" | "closed";
  account_id?: string | null;
  notes?: string | null;
}

export interface Receivable {
  id: string;
  person: string;
  description: string;
  original_amount: number;
  received_amount: number;
  currency: Currency;
  total_installments?: number | null;
  received_installments?: number;
  next_due_date?: string | null;
  status: "active" | "partial" | "settled" | "late" | "cancelled";
  notes?: string | null;
}

export interface Bucket {
  id: string;
  name: string;
  color: string;
  kind: "tax" | "emergency" | "home" | "car" | "savings" | "investment" | "free" | "custom";
  currency: Currency;
  allocated: number;
}

export interface RecurringItem {
  id: string;
  name: string;
  amount: number;
  currency: Currency;
  payment_day?: number | null;
  frequency: string;
  start_date: string;
  end_date?: string | null;
  is_estimate: boolean;
  active: boolean;
  account_id?: string | null;
  notes?: string | null;
}
