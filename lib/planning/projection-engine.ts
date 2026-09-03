import { addMonths, compareMonths, monthRange, yearOf } from "./dates";
import { amortizeMortgageMonth, monthlyMortgagePayment } from "./mortgage";
import type {
  FinancialScenario,
  HouseProjectionMetrics,
  ProjectionEvent,
  ProjectionMonth,
  ProjectionResult,
  ScenarioComparison,
  YearProjection,
} from "./types";

const isActive = (month: string, startMonth: string, endMonth?: string) =>
  compareMonths(month, startMonth) >= 0 && (!endMonth || compareMonths(month, endMonth) <= 0);

const findExpense = (scenario: FinancialScenario, id: string) => scenario.recurringExpenses.find((item) => item.id === id);

function event(id: string, month: string, title: string, detail: string, liquidityImpact: number, kind: ProjectionEvent["kind"], futureMonthlyImpact?: number): ProjectionEvent {
  return { id, month, title, detail, liquidityImpact, kind, futureMonthlyImpact };
}

function projectMonths(scenario: FinancialScenario) {
  let availableLiquidity = scenario.openingAvailableLiquidity.value;
  let taxReserve = scenario.openingTaxReserve.value;
  let investments = scenario.openingInvestments.value;
  let mortgagePrincipal = 0;
  let homeValue = 0;
  let hasPurchasedHome = false;
  let monthsSincePurchase = 0;
  const allEvents: ProjectionEvent[] = [];
  const months: ProjectionMonth[] = [];
  const mortgagePrincipalAtPurchase = scenario.housing.purchasePrice.value * scenario.housing.mortgage.ltv.value;
  const fullMortgagePayment = monthlyMortgagePayment(
    mortgagePrincipalAtPurchase,
    scenario.housing.mortgage.annualInterestRate.value,
    scenario.housing.mortgage.termYears.value,
  );
  const tesla = findExpense(scenario, "tesla");
  const findomestic = findExpense(scenario, "findomestic");

  for (const month of monthRange(scenario.startMonth, scenario.endMonth)) {
    const openingAvailableLiquidity = availableLiquidity;
    const openingTaxReserve = taxReserve;
    const openingInvestments = investments;
    const monthEvents: ProjectionEvent[] = [];
    const monthNumber = Number(month.slice(5, 7));

    const normalIncome = scenario.monthlyNetIncome.value;
    const seniorIncome = scenario.senior.enabled && compareMonths(month, scenario.senior.effectiveMonth.value) >= 0
      ? scenario.senior.monthlyIncrease.value
      : 0;
    const overtimeIncome = scenario.monthlyOvertimeIncome.value;
    const otherIncome = scenario.otherMonthlyIncome.value;
    const extraordinaryIncome = monthNumber === scenario.annualExtraIncomeMonth ? scenario.annualExtraIncome.value : 0;
    const totalIncome = normalIncome + seniorIncome + overtimeIncome + otherIncome + extraordinaryIncome;

    if (scenario.senior.enabled && month === scenario.senior.effectiveMonth.value) {
      monthEvents.push(event("senior-start", month, "Senior increase starts", `+€${scenario.senior.monthlyIncrease.value.toFixed(0)} net each month`, 0, "income", scenario.senior.monthlyIncrease.value));
    }
    if (scenario.livingTogether.enabled && month === scenario.livingTogether.effectiveMonth.value) {
      monthEvents.push(event("living-together-start", month, "Living together starts", `€${scenario.livingTogether.monthlyCost.value.toFixed(0)} additional monthly cost`, 0, "milestone", -scenario.livingTogether.monthlyCost.value));
    }

    let recurringExpenses = 0;
    let debtPayments = 0;
    for (const item of scenario.recurringExpenses) {
      if (!isActive(month, item.startMonth, item.endMonth)) continue;
      if (item.id === "findomestic" && scenario.findomesticPayoff.enabled && compareMonths(month, scenario.findomesticPayoff.month.value) > 0) continue;
      let amount = item.amount.value;
      if (item.id === "tesla" && scenario.teslaPartialRepayment.enabled && compareMonths(month, scenario.teslaPartialRepayment.month.value) > 0) {
        amount = scenario.teslaPartialRepayment.resultingMonthlyPayment.value;
      }
      if (item.kind === "debt") debtPayments += amount;
      else recurringExpenses += amount;
      if (item.endMonth === month && item.id !== "findomestic") {
        monthEvents.push(event(`${item.id}-ends`, month, `${item.name} payments end`, `Releases €${item.amount.value.toFixed(2)} per month from next month`, 0, "milestone", item.amount.value));
      }
    }

    const taxReserveContribution = compareMonths(month, scenario.taxReserveTransitionMonth.value) < 0
      ? scenario.taxReserveBeforeTransition.value
      : scenario.taxReserveAfterTransition.value;
    const lifestyleBuffer = scenario.lifestyleBuffer.value;
    const livingTogetherCost = scenario.livingTogether.enabled && compareMonths(month, scenario.livingTogether.effectiveMonth.value) >= 0
      ? scenario.livingTogether.monthlyCost.value
      : 0;

    const teslaPartialRepayment = scenario.teslaPartialRepayment.enabled && month === scenario.teslaPartialRepayment.month.value
      ? scenario.teslaPartialRepayment.amount.value
      : 0;
    if (teslaPartialRepayment) {
      const reduction = Math.max(0, (tesla?.amount.value ?? 0) - scenario.teslaPartialRepayment.resultingMonthlyPayment.value);
      monthEvents.push(event("tesla-partial", month, "Tesla partial repayment", `Estimated payment falls to €${scenario.teslaPartialRepayment.resultingMonthlyPayment.value.toFixed(0)} per month`, -teslaPartialRepayment, "debt", reduction));
    }

    const findomesticPayoff = scenario.findomesticPayoff.enabled && month === scenario.findomesticPayoff.month.value
      ? scenario.findomesticPayoff.amount.value
      : 0;
    if (findomesticPayoff) {
      monthEvents.push(event("findomestic-payoff", month, "Findomestic paid off", `Releases €${(findomestic?.amount.value ?? 0).toFixed(0)} per month`, -findomesticPayoff, "debt", findomestic?.amount.value ?? 0));
    }

    let housePurchaseCash = 0;
    if (scenario.housing.enabled && month === scenario.housing.purchaseMonth.value) {
      hasPurchasedHome = true;
      mortgagePrincipal = mortgagePrincipalAtPurchase;
      homeValue = scenario.housing.purchasePrice.value;
      monthsSincePurchase = 0;
      const userDownPayment = (scenario.housing.purchasePrice.value - mortgagePrincipalAtPurchase) * scenario.housing.ownershipShare.value;
      const userCosts = scenario.housing.purchaseCosts.value * scenario.housing.ownershipShare.value;
      housePurchaseCash = userDownPayment + userCosts;
      monthEvents.push(event("house-purchase", month, "Home purchase", `${Math.round(scenario.housing.mortgage.ltv.value * 100)}% LTV · ${(scenario.housing.ownershipShare.value * 100).toFixed(0)}% share`, -housePurchaseCash, "housing"));
    }

    let mortgagePayment = 0;
    let mortgageInterest = 0;
    let mortgagePrincipalRepaid = 0;
    if (hasPurchasedHome) {
      const period = amortizeMortgageMonth(mortgagePrincipal, scenario.housing.mortgage.annualInterestRate.value, fullMortgagePayment);
      mortgagePrincipal = period.closingPrincipal;
      mortgagePayment = period.payment * scenario.housing.ownershipShare.value;
      mortgageInterest = period.interest * scenario.housing.ownershipShare.value;
      mortgagePrincipalRepaid = period.principal * scenario.housing.ownershipShare.value;
      if (monthsSincePurchase > 0 && scenario.housing.annualHomeAppreciation.value !== 0) {
        homeValue *= Math.pow(1 + scenario.housing.annualHomeAppreciation.value, 1 / 12);
      }
      monthsSincePurchase += 1;
    }

    const housingLivingCosts = hasPurchasedHome ? scenario.housing.additionalLivingCosts.value : 0;
    const investmentContribution = scenario.investments.enabled ? scenario.investments.monthlyContribution.value : 0;
    const monthlyInvestmentRate = scenario.investments.enabled
      ? Math.pow(1 + scenario.investments.annualReturn.value, 1 / 12) - 1
      : 0;
    const investmentReturn = investments * monthlyInvestmentRate;

    const totalOutflow = recurringExpenses + debtPayments + taxReserveContribution + lifestyleBuffer + livingTogetherCost
      + teslaPartialRepayment + findomesticPayoff + housePurchaseCash + mortgagePayment + housingLivingCosts + investmentContribution;
    availableLiquidity = openingAvailableLiquidity + totalIncome - totalOutflow;
    taxReserve = openingTaxReserve + taxReserveContribution;
    investments = openingInvestments + investmentReturn + investmentContribution;
    const homeEquity = hasPurchasedHome
      ? Math.max(0, (homeValue - mortgagePrincipal) * scenario.housing.ownershipShare.value)
      : 0;
    const netWorth = availableLiquidity + investments + homeEquity;

    allEvents.push(...monthEvents);
    months.push({
      month,
      openingAvailableLiquidity,
      normalIncome,
      seniorIncome,
      overtimeIncome,
      otherIncome,
      extraordinaryIncome,
      totalIncome,
      recurringExpenses,
      debtPayments,
      taxReserveContribution,
      lifestyleBuffer,
      livingTogetherCost,
      teslaPartialRepayment,
      findomesticPayoff,
      housePurchaseCash,
      mortgagePayment,
      housingLivingCosts,
      investmentContribution,
      totalOutflow,
      closingAvailableLiquidity: availableLiquidity,
      openingTaxReserve,
      closingTaxReserve: taxReserve,
      openingInvestments,
      investmentReturn,
      closingInvestments: investments,
      mortgageInterest,
      mortgagePrincipalRepaid,
      remainingMortgagePrincipal: mortgagePrincipal,
      homeValue,
      homeEquity,
      netWorth,
      events: monthEvents,
    });
  }

  return { months, events: allEvents };
}

function buildYearly(scenario: FinancialScenario, months: ProjectionMonth[]) {
  const yearly: YearProjection[] = [];
  if (scenario.startMonth.endsWith("-01")) {
    yearly.push({
      year: yearOf(scenario.startMonth) - 1,
      liquidity: scenario.openingAvailableLiquidity.value,
      investments: scenario.openingInvestments.value,
      taxReserve: scenario.openingTaxReserve.value,
      homeEquity: 0,
      netWorth: scenario.openingAvailableLiquidity.value + scenario.openingInvestments.value,
    });
  }
  for (const item of months) {
    if (!item.month.endsWith("-12") && item !== months.at(-1)) continue;
    yearly.push({
      year: yearOf(item.month),
      liquidity: item.closingAvailableLiquidity,
      investments: item.closingInvestments,
      taxReserve: item.closingTaxReserve,
      homeEquity: item.homeEquity,
      netWorth: item.netWorth,
    });
  }
  return yearly;
}

function monthAtOrBefore(months: ProjectionMonth[], target: string) {
  return [...months].reverse().find((item) => compareMonths(item.month, target) <= 0);
}

function buildHouseMetrics(scenario: FinancialScenario, months: ProjectionMonth[]): HouseProjectionMetrics | undefined {
  if (!scenario.housing.enabled) return undefined;
  const purchaseMonth = months.find((item) => item.month === scenario.housing.purchaseMonth.value);
  if (!purchaseMonth) return undefined;
  const principal = scenario.housing.purchasePrice.value * scenario.housing.mortgage.ltv.value;
  const downPayment = scenario.housing.purchasePrice.value - principal;
  const userDownPayment = downPayment * scenario.housing.ownershipShare.value;
  const userPurchaseCosts = scenario.housing.purchaseCosts.value * scenario.housing.ownershipShare.value;
  const mortgagePayment = monthlyMortgagePayment(principal, scenario.housing.mortgage.annualInterestRate.value, scenario.housing.mortgage.termYears.value);
  const userMortgagePayment = mortgagePayment * scenario.housing.ownershipShare.value;
  const teslaPayment = scenario.teslaPartialRepayment.enabled
    ? scenario.teslaPartialRepayment.resultingMonthlyPayment.value
    : findExpense(scenario, "tesla")?.amount.value ?? 0;
  const availableBeforePurchase = purchaseMonth.openingAvailableLiquidity + (scenario.teslaPartialRepayment.enabled && compareMonths(scenario.teslaPartialRepayment.month.value, scenario.housing.purchaseMonth.value) < 0 ? scenario.teslaPartialRepayment.amount.value : 0);
  const totalUpfrontCashRequired = userDownPayment + userPurchaseCosts + (scenario.teslaPartialRepayment.enabled ? scenario.teslaPartialRepayment.amount.value : 0);
  const availableAfterPurchase = availableBeforePurchase - totalUpfrontCashRequired;
  const recurringAfterPurchase = purchaseMonth.recurringExpenses + purchaseMonth.debtPayments - (scenario.teslaPartialRepayment.enabled ? teslaPayment : 0);
  const afterOne = monthAtOrBefore(months, addMonths(scenario.housing.purchaseMonth.value, 11));
  const afterThree = monthAtOrBefore(months, addMonths(scenario.housing.purchaseMonth.value, 35));
  const afterFive = monthAtOrBefore(months, addMonths(scenario.housing.purchaseMonth.value, 59));
  return {
    purchasePrice: scenario.housing.purchasePrice.value,
    mortgagePrincipal: principal,
    ltv: scenario.housing.mortgage.ltv.value,
    downPayment,
    userDownPayment,
    estimatedPurchaseCosts: scenario.housing.purchaseCosts.value,
    userPurchaseCosts,
    mortgagePayment,
    userMortgagePayment,
    teslaPayment,
    additionalLivingCosts: scenario.housing.additionalLivingCosts.value,
    monthlyFixedCostAfterPurchase: recurringAfterPurchase + teslaPayment + userMortgagePayment + scenario.housing.additionalLivingCosts.value,
    totalUpfrontCashRequired,
    availableBeforePurchase,
    availableAfterPurchase,
    bufferDifference: availableAfterPurchase - scenario.minimumLiquidityBuffer.value,
    liquidityAfterOneYear: afterOne?.closingAvailableLiquidity ?? availableAfterPurchase,
    liquidityAfterThreeYears: afterThree?.closingAvailableLiquidity ?? availableAfterPurchase,
    liquidityAfterFiveYears: afterFive?.closingAvailableLiquidity ?? null,
  };
}

export function runProjection(scenario: FinancialScenario): ProjectionResult {
  const { months, events } = projectMonths(scenario);
  if (!months.length) throw new Error("Projection requires at least one month.");
  const openingCandidate = { month: addMonths(scenario.startMonth, -1), value: scenario.openingAvailableLiquidity.value };
  const minimum = months.reduce((lowest, item) => item.closingAvailableLiquidity < lowest.value ? { month: item.month, value: item.closingAvailableLiquidity } : lowest, openingCandidate);
  return {
    scenario,
    months,
    events,
    yearly: buildYearly(scenario, months),
    finalMonth: months.at(-1)!,
    minimumAvailableLiquidity: minimum.value,
    minimumLiquidityMonth: minimum.month,
    safeToInvest: Math.max(0, minimum.value - scenario.minimumLiquidityBuffer.value),
    house: buildHouseMetrics(scenario, months),
  };
}

export function compareProjectionResults(base: ProjectionResult, comparison: ProjectionResult): ScenarioComparison {
  const baseCapacity = base.finalMonth.totalIncome - base.finalMonth.totalOutflow;
  const comparisonCapacity = comparison.finalMonth.totalIncome - comparison.finalMonth.totalOutflow;
  return {
    baseName: base.scenario.name,
    comparisonName: comparison.scenario.name,
    finalLiquidityDelta: comparison.finalMonth.closingAvailableLiquidity - base.finalMonth.closingAvailableLiquidity,
    finalNetWorthDelta: comparison.finalMonth.netWorth - base.finalMonth.netWorth,
    minimumLiquidityDelta: comparison.minimumAvailableLiquidity - base.minimumAvailableLiquidity,
    monthlySavingsCapacityDelta: comparisonCapacity - baseCapacity,
    homeEquityDelta: comparison.finalMonth.homeEquity - base.finalMonth.homeEquity,
  };
}
