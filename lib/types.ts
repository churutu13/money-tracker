export type TransactionType = "income" | "expense" | "transfer";
export type Frequency = "weekly" | "monthly" | "yearly" | "custom";
export type ExpenseKind = "fixed" | "variable";

export interface FundAccount {
  id: string;
  name: string;
  balance: number;
}

export interface Fund {
  id: string;
  name: string;
  balance: number;
  kind: "income" | "available" | "savings" | "tax" | "emergency" | "custom";
  accounts?: FundAccount[];
  monthlyBalances?: Record<string, number>;
  cycleEntries?: Record<string, CycleEntry>;
}

export interface CycleEntry {
  income: number;
  fixed: number;
  lifestyle: number;
}

export interface Recurrence {
  frequency: Frequency;
  interval?: number;
  paymentDay?: number;
  startDate: string;
  endDate?: string;
  paymentCount?: number;
  amexReservedDates?: string[];
  spendingBudget?: boolean;
}

export interface Transaction {
  id: string;
  name: string;
  amount: number;
  type: TransactionType;
  date: string;
  category?: string;
  notes?: string;
  fundId: string;
  fundAccountId?: string;
  destinationFundId?: string;
  destinationFundAccountId?: string;
  expenseKind?: ExpenseKind;
  paymentMethod?: "bank" | "amex";
  amexReserved?: boolean;
  recurringBudgetId?: string;
  recurrence?: Recurrence;
  createdAt: string;
}

export interface SalaryProfile {
  id: string;
  name: string;
  usableMonthlyIncome: number;
  payday: number;
  grossSalary?: number;
  overtimeGrossRate?: number;
  averageOvertimeHours: number;
  overtimeNetRatio: number;
  thirteenthSalaryMonths: number[];
  taxStrategy: "fixed" | "percentage" | "manual";
  taxValue: number;
  monthlyOvertime?: Record<string, { hours: number; usableOverride?: number }>;
}

export interface FlowSettings {
  currency: string;
  locale: string;
  safetyBuffer: number;
  monthlyLifestyleBudget: number;
  expectedTaxBill: number;
}

export interface FrontaxEntry {
  id: string;
  year: number;
  month: number;
  grossIncomeChf: number;
  netIncomeChf: number;
  socialContributionsChf: number;
  taxAtSourceChf: number;
  exchangeRate: number;
  updatedAt: string;
}

export interface FrontaxYearAdjustments {
  deductionsEur: number;
  priorAdvancesEur: number;
}

export interface FlowData {
  schemaVersion?: number;
  funds: Fund[];
  transactions: Transaction[];
  salaryProfiles: SalaryProfile[];
  settings: FlowSettings;
  frontaxEntries?: FrontaxEntry[];
  frontaxYearAdjustments?: Record<string, FrontaxYearAdjustments>;
}
