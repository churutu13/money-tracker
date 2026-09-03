import type { FlowData } from "../types";

export type AssumptionStatus = "estimated" | "confirmed" | "actual";

export interface FinancialAssumption<T = number> {
  id: string;
  label: string;
  value: T;
  unit: string;
  status: AssumptionStatus;
  source: string;
  note?: string;
}

export interface RecurringPlanningExpense {
  id: string;
  name: string;
  amount: FinancialAssumption<number>;
  startMonth: string;
  endMonth?: string;
  kind: "recurring" | "debt";
  alreadyIncludedInFlow: boolean;
}

export interface Debt {
  id: string;
  name: string;
  monthlyPayment: FinancialAssumption<number>;
  payoffAmount?: FinancialAssumption<number>;
  payoffMonth?: FinancialAssumption<string>;
  balance?: FinancialAssumption<number>;
}

export interface MortgageScenario {
  annualInterestRate: FinancialAssumption<number>;
  termYears: FinancialAssumption<number>;
  ltv: FinancialAssumption<number>;
}

export interface HousingScenario {
  enabled: boolean;
  buying: "alone" | "together";
  purchasePrice: FinancialAssumption<number>;
  purchaseMonth: FinancialAssumption<string>;
  ownershipShare: FinancialAssumption<number>;
  purchaseCosts: FinancialAssumption<number>;
  additionalLivingCosts: FinancialAssumption<number>;
  mortgage: MortgageScenario;
  annualHomeAppreciation: FinancialAssumption<number>;
}

export interface FinancialScenario {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  startMonth: string;
  endMonth: string;
  openingAvailableLiquidity: FinancialAssumption<number>;
  openingTaxReserve: FinancialAssumption<number>;
  openingInvestments: FinancialAssumption<number>;
  monthlyNetIncome: FinancialAssumption<number>;
  annualExtraIncome: FinancialAssumption<number>;
  annualExtraIncomeMonth: number;
  monthlyOvertimeIncome: FinancialAssumption<number>;
  otherMonthlyIncome: FinancialAssumption<number>;
  taxReserveBeforeTransition: FinancialAssumption<number>;
  taxReserveAfterTransition: FinancialAssumption<number>;
  taxReserveTransitionMonth: FinancialAssumption<string>;
  lifestyleBuffer: FinancialAssumption<number>;
  minimumLiquidityBuffer: FinancialAssumption<number>;
  warningLiquidityBuffer: FinancialAssumption<number>;
  findomesticPayoff: {
    enabled: boolean;
    amount: FinancialAssumption<number>;
    month: FinancialAssumption<string>;
  };
  senior: {
    enabled: boolean;
    monthlyIncrease: FinancialAssumption<number>;
    effectiveMonth: FinancialAssumption<string>;
  };
  livingTogether: {
    enabled: boolean;
    monthlyCost: FinancialAssumption<number>;
    effectiveMonth: FinancialAssumption<string>;
  };
  teslaPartialRepayment: {
    enabled: boolean;
    amount: FinancialAssumption<number>;
    month: FinancialAssumption<string>;
    resultingMonthlyPayment: FinancialAssumption<number>;
  };
  investments: {
    enabled: boolean;
    annualReturn: FinancialAssumption<number>;
    monthlyContribution: FinancialAssumption<number>;
  };
  recurringExpenses: RecurringPlanningExpense[];
  housing: HousingScenario;
}

export interface ProjectionEvent {
  id: string;
  month: string;
  title: string;
  detail: string;
  liquidityImpact: number;
  futureMonthlyImpact?: number;
  kind: "income" | "expense" | "debt" | "housing" | "milestone";
}

export interface ProjectionMonth {
  month: string;
  openingAvailableLiquidity: number;
  normalIncome: number;
  seniorIncome: number;
  overtimeIncome: number;
  otherIncome: number;
  extraordinaryIncome: number;
  totalIncome: number;
  recurringExpenses: number;
  debtPayments: number;
  taxReserveContribution: number;
  lifestyleBuffer: number;
  livingTogetherCost: number;
  teslaPartialRepayment: number;
  findomesticPayoff: number;
  housePurchaseCash: number;
  mortgagePayment: number;
  housingLivingCosts: number;
  investmentContribution: number;
  totalOutflow: number;
  closingAvailableLiquidity: number;
  openingTaxReserve: number;
  closingTaxReserve: number;
  openingInvestments: number;
  investmentReturn: number;
  closingInvestments: number;
  mortgageInterest: number;
  mortgagePrincipalRepaid: number;
  remainingMortgagePrincipal: number;
  homeValue: number;
  homeEquity: number;
  netWorth: number;
  events: ProjectionEvent[];
  actualAvailableLiquidity?: number;
}

export interface YearProjection {
  year: number;
  liquidity: number;
  investments: number;
  taxReserve: number;
  homeEquity: number;
  netWorth: number;
}

export interface HouseProjectionMetrics {
  purchasePrice: number;
  mortgagePrincipal: number;
  ltv: number;
  downPayment: number;
  userDownPayment: number;
  estimatedPurchaseCosts: number;
  userPurchaseCosts: number;
  mortgagePayment: number;
  userMortgagePayment: number;
  teslaPayment: number;
  additionalLivingCosts: number;
  monthlyFixedCostAfterPurchase: number;
  totalUpfrontCashRequired: number;
  availableBeforePurchase: number;
  availableAfterPurchase: number;
  bufferDifference: number;
  liquidityAfterOneYear: number;
  liquidityAfterThreeYears: number;
  liquidityAfterFiveYears: number | null;
}

export interface ProjectionResult {
  scenario: FinancialScenario;
  months: ProjectionMonth[];
  events: ProjectionEvent[];
  yearly: YearProjection[];
  finalMonth: ProjectionMonth;
  minimumAvailableLiquidity: number;
  minimumLiquidityMonth: string;
  safeToInvest: number;
  house?: HouseProjectionMetrics;
}

export interface ScenarioComparison {
  baseName: string;
  comparisonName: string;
  finalLiquidityDelta: number;
  finalNetWorthDelta: number;
  minimumLiquidityDelta: number;
  monthlySavingsCapacityDelta: number;
  homeEquityDelta: number;
}

export interface FinancialPlanWorkspace {
  version: 1;
  activeScenarioId: string;
  scenarios: FinancialScenario[];
  compareScenarioId?: string;
  useFlowActuals: boolean;
}

export interface PlanningActualsSnapshot {
  availableLiquidity: number;
  taxReserve: number;
  salary?: number;
  recurringExpenses: RecurringPlanningExpense[];
  sourceData: FlowData;
}
