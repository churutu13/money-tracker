import type { FinancialAssumption, FinancialScenario, RecurringPlanningExpense } from "./types";

const now = "2026-09-03T00:00:00.000Z";

function assumption<T>(id: string, label: string, value: T, unit: string, status: FinancialAssumption<T>["status"], source: string, note?: string): FinancialAssumption<T> {
  return { id, label, value, unit, status, source, note };
}

const expense = (id: string, name: string, amount: number, endMonth?: string, status: FinancialAssumption<number>["status"] = "estimated", kind: RecurringPlanningExpense["kind"] = "recurring"): RecurringPlanningExpense => ({
  id,
  name,
  amount: assumption(`${id}-amount`, name, amount, "EUR/month", status, "Financial_Projection_2026_2031_Updated.xlsx"),
  startMonth: "2027-01",
  endMonth,
  kind,
  alreadyIncludedInFlow: false,
});

export const WORKBOOK_EXPENSES: RecurringPlanningExpense[] = [
  expense("tesla", "Tesla lease", 506, undefined, "confirmed", "debt"),
  expense("gym", "Gym", 27.3, undefined, "actual"),
  expense("watch", "Apple Watch", 25.44, "2028-08", "confirmed"),
  expense("spotify", "Spotify", 11.99, undefined, "actual"),
  expense("phone", "Mobile top-up", 9.99, undefined, "actual"),
  expense("telepass", "Telepass", 60),
  expense("imu", "IMU extra", 122, "2028-03", "confirmed"),
  expense("electricity", "Electricity / home", 150),
  expense("amex", "Amex", 22, undefined, "actual"),
  expense("charging", "Tesla charging", 100),
  expense("chatgpt", "ChatGPT", 23, undefined, "actual"),
  expense("rackets", "Tennis rackets", 38, "2027-03", "confirmed"),
  expense("tesla-insurance", "Tesla insurance", 150, undefined, "confirmed"),
  expense("findomestic", "Findomestic", 300, "2027-12", "confirmed", "debt"),
];

export function createWorkbookScenario(id = "base", name = "Base"): FinancialScenario {
  return {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    startMonth: "2027-01",
    endMonth: "2031-12",
    openingAvailableLiquidity: assumption("opening-liquidity", "Available savings at 31 Dec 2026", 15500, "EUR", "estimated", "Workbook starting position"),
    openingTaxReserve: assumption("opening-tax-reserve", "Current tax reserve", 6739, "EUR", "actual", "Flow tax fund / workbook context"),
    openingInvestments: assumption("opening-investments", "Current liquid investments", 0, "EUR", "estimated", "No investment balance supplied"),
    monthlyNetIncome: assumption("monthly-income", "Monthly net salary", 3600, "EUR/month", "estimated", "Workbook assumption", "Replace with confirmed Flow salary when appropriate."),
    annualExtraIncome: assumption("annual-extra-income", "13th salary net savings", 2000, "EUR/year", "estimated", "Workbook assumption"),
    annualExtraIncomeMonth: 12,
    monthlyOvertimeIncome: assumption("overtime-income", "Future overtime", 0, "EUR/month", "estimated", "Conservative default"),
    otherMonthlyIncome: assumption("other-income", "Other income", 0, "EUR/month", "estimated", "User assumption"),
    taxReserveBeforeTransition: assumption("tax-before", "Tax reserve through 2027", 850, "EUR/month", "estimated", "Workbook formula", "The workbook label says through Nov-2027, but its formulas apply this amount for all of 2027."),
    taxReserveAfterTransition: assumption("tax-after", "Tax reserve from 2028", 650, "EUR/month", "estimated", "Workbook / Frontax model"),
    taxReserveTransitionMonth: assumption("tax-transition", "Tax reserve change", "2028-01", "month", "estimated", "Workbook formula"),
    lifestyleBuffer: assumption("lifestyle-buffer", "Monthly lifestyle buffer", 350, "EUR/month", "estimated", "User assumption"),
    minimumLiquidityBuffer: assumption("minimum-buffer", "Target cash buffer", 15000, "EUR", "estimated", "Personal safety target"),
    warningLiquidityBuffer: assumption("warning-buffer", "Lower warning threshold", 12000, "EUR", "estimated", "Personal safety target"),
    findomesticPayoff: {
      enabled: true,
      amount: assumption("findomestic-payoff", "Findomestic early repayment", 11000, "EUR", "estimated", "Workbook assumption"),
      month: assumption("findomestic-payoff-month", "Findomestic payoff date", "2027-12", "month", "estimated", "Workbook assumption"),
    },
    senior: {
      enabled: false,
      monthlyIncrease: assumption("senior-income", "Senior salary increase", 200, "EUR/month", "estimated", "Scenario assumption"),
      effectiveMonth: assumption("senior-month", "Senior effective date", "2027-07", "month", "estimated", "Scenario assumption"),
    },
    livingTogether: {
      enabled: false,
      monthlyCost: assumption("cohabitation-cost", "Living together", 250, "EUR/month", "estimated", "User assumption"),
      effectiveMonth: assumption("cohabitation-month", "Living together date", "2028-01", "month", "estimated", "User assumption"),
    },
    teslaPartialRepayment: {
      enabled: false,
      amount: assumption("tesla-paydown", "Tesla partial repayment", 10000, "EUR", "estimated", "Scenario assumption"),
      month: assumption("tesla-paydown-month", "Tesla repayment date", "2028-12", "month", "estimated", "Scenario assumption"),
      resultingMonthlyPayment: assumption("tesla-result-payment", "Tesla payment after repayment", 212, "EUR/month", "estimated", "Model estimate", "Not confirmed by Santander."),
    },
    investments: {
      enabled: false,
      annualReturn: assumption("investment-return", "Expected annual return", 0, "%", "estimated", "User assumption", "Investment returns are not guaranteed."),
      monthlyContribution: assumption("investment-contribution", "Monthly investment contribution", 0, "EUR/month", "estimated", "User assumption"),
    },
    recurringExpenses: WORKBOOK_EXPENSES.map((item) => ({ ...item, amount: { ...item.amount } })),
    housing: {
      enabled: false,
      buying: "alone",
      purchasePrice: assumption("house-price", "Purchase price", 150000, "EUR", "estimated", "User scenario"),
      purchaseMonth: assumption("house-month", "Purchase date", "2029-01", "month", "estimated", "Workbook scenario"),
      ownershipShare: assumption("house-share", "Ownership and payment share", 1, "%", "estimated", "User scenario"),
      purchaseCosts: assumption("house-costs", "Estimated purchase costs", 10000, "EUR", "estimated", "Workbook placeholder"),
      additionalLivingCosts: assumption("house-living-costs", "Additional living costs", 550, "EUR/month", "estimated", "Workbook assumption", "Excludes expenses already represented in Flow."),
      mortgage: {
        annualInterestRate: assumption("mortgage-rate", "Mortgage interest rate", 0.035, "% annual", "estimated", "Workbook assumption"),
        termYears: assumption("mortgage-term", "Mortgage term", 25, "years", "estimated", "Workbook assumption"),
        ltv: assumption("mortgage-ltv", "Mortgage LTV", 0.8, "%", "estimated", "Scenario assumption", "90% LTV is hypothetical and subject to eligibility and future availability."),
      },
      annualHomeAppreciation: assumption("home-appreciation", "Home price appreciation", 0, "% annual", "estimated", "Conservative default"),
    },
  };
}

export function cloneScenario(scenario: FinancialScenario, id = scenario.id, name = scenario.name): FinancialScenario {
  return { ...structuredClone(scenario), id, name, updatedAt: new Date().toISOString() };
}

export function createInitialPlanningWorkspace() {
  const base = createWorkbookScenario();
  const senior = cloneScenario(base, "senior", "Senior");
  senior.senior.enabled = true;
  const together = cloneScenario(base, "living-together", "Living together");
  together.livingTogether.enabled = true;
  const seniorTogether = cloneScenario(base, "senior-living-together", "Senior + living together");
  seniorTogether.senior.enabled = true;
  seniorTogether.livingTogether.enabled = true;
  return {
    version: 1 as const,
    activeScenarioId: "base",
    compareScenarioId: "senior",
    scenarios: [base, senior, together, seniorTogether],
    useFlowActuals: true,
  };
}
