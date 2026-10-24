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
  payCycleResets?: Record<string, PayCycleReset>;
}

export interface CycleEntry {
  income: number;
  fixed: number;
  lifestyle: number;
  savings?: number;
  availableOverride?: number;
  overrideTransactionBaseline?: number;
}

export interface PayCycleReset {
  startDate: string;
  excludedTransactionIds: string[];
  previousEntry?: CycleEntry;
  salaryId?: string;
  previousOvertime?: { hours: number; usableOverride?: number };
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
  loan?: { id: string; kind: "advance" | "repayment"; direction: 1 | -1; planId?: string };
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
  loans?: PersonalLoan[];
  schemaVersion?: number;
  funds: Fund[];
  transactions: Transaction[];
  salaryProfiles: SalaryProfile[];
  settings: FlowSettings;
  frontaxEntries?: FrontaxEntry[];
  frontaxYearAdjustments?: Record<string, FrontaxYearAdjustments>;
}

export interface LoanPlanMovement {
  id: string;
  kind: "advance" | "repayment";
  date: string;
  amount: number;
  notes?: string;
}
export interface PersonalLoan {
  id: string;
  title: string;
  person: string;
  type: "given" | "received";
  currency: "EUR";
  notes: string;
  startDate: string;
  startConfirmed: boolean;
  cap?: number;
  fundId: string;
  fundAccountId?: string;
  linkedFundId?: string;
  repaymentFrom?: string;
  repaymentTo?: string;
  monthlyAdvance?: number;
  advanceEnd?: string;
  suspended: boolean;
  archived: boolean;
  plan: LoanPlanMovement[];
}
