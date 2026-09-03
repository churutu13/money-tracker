import assert from "node:assert/strict";
import test from "node:test";
import { cloneScenario, createWorkbookScenario } from "../../lib/planning/assumptions";
import { monthlyMortgagePayment, remainingMortgagePrincipal } from "../../lib/planning/mortgage";
import { compareProjectionResults, runProjection } from "../../lib/planning/projection-engine";
import { configureHouseScenario, validateAgainstWorkbook } from "../../lib/planning/validation";

const closeTo = (actual: number, expected: number, tolerance = 0.01) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const month = (result: ReturnType<typeof runProjection>, key: string) => result.months.find((item) => item.month === key)!;

test("baseline monthly cash flow matches workbook components", () => {
  const result = runProjection(createWorkbookScenario());
  const january = month(result, "2027-01");
  closeTo(january.recurringExpenses + january.debtPayments, 1545.72);
  closeTo(january.closingAvailableLiquidity, 15500 + 3600 - 1545.72 - 850 - 350);
});

test("expense end dates change at March to April boundaries", () => {
  const result = runProjection(createWorkbookScenario());
  closeTo(month(result, "2027-03").recurringExpenses + month(result, "2027-03").debtPayments, 1545.72);
  closeTo(month(result, "2027-04").recurringExpenses + month(result, "2027-04").debtPayments, 1507.72);
  closeTo(month(result, "2028-03").recurringExpenses + month(result, "2028-03").debtPayments, 1207.72);
  closeTo(month(result, "2028-04").recurringExpenses + month(result, "2028-04").debtPayments, 1085.72);
  closeTo(month(result, "2028-08").recurringExpenses + month(result, "2028-08").debtPayments, 1085.72);
  closeTo(month(result, "2028-09").recurringExpenses + month(result, "2028-09").debtPayments, 1060.28);
});

test("senior salary starts in July 2027", () => {
  const scenario = createWorkbookScenario();
  scenario.senior.enabled = true;
  const result = runProjection(scenario);
  assert.equal(month(result, "2027-06").seniorIncome, 0);
  assert.equal(month(result, "2027-07").seniorIncome, 200);
});

test("tax reserve switches in January 2028", () => {
  const result = runProjection(createWorkbookScenario());
  assert.equal(month(result, "2027-12").taxReserveContribution, 850);
  assert.equal(month(result, "2028-01").taxReserveContribution, 650);
});

test("Findomestic payoff occurs once and removes the monthly payment", () => {
  const result = runProjection(createWorkbookScenario());
  assert.equal(month(result, "2027-12").findomesticPayoff, 11000);
  assert.equal(month(result, "2027-12").debtPayments, 806);
  assert.equal(month(result, "2028-01").debtPayments, 506);
});

test("Tesla partial repayment changes payment after December 2028", () => {
  const scenario = createWorkbookScenario();
  scenario.teslaPartialRepayment.enabled = true;
  const result = runProjection(scenario);
  assert.equal(month(result, "2028-12").teslaPartialRepayment, 10000);
  assert.equal(month(result, "2028-12").debtPayments, 506);
  assert.equal(month(result, "2029-01").debtPayments, 212);
});

test("mortgage payment examples match workbook", () => {
  closeTo(monthlyMortgagePayment(135000, 0.035, 25), 675.8418198503, 0.0001);
  closeTo(monthlyMortgagePayment(180000, 0.035, 25), 901.1224264671, 0.0001);
});

test("mortgage amortization matches workbook after 36 payments", () => {
  closeTo(150000 - remainingMortgagePrincipal(120000, 0.035, 25, 36), 39503.2919795068, 0.0001);
});

test("house down payment and 50/50 split are calculated", () => {
  const alone = runProjection(configureHouseScenario(createWorkbookScenario(), { together: false, ltv: 0.8, tesla: false }));
  const together = runProjection(configureHouseScenario(createWorkbookScenario(), { together: true, ltv: 0.8, tesla: false }));
  assert.equal(alone.house?.downPayment, 30000);
  assert.equal(alone.house?.userDownPayment, 30000);
  assert.equal(together.house?.downPayment, 40000);
  assert.equal(together.house?.userDownPayment, 20000);
});

test("post-purchase liquidity includes down payment, costs, and Tesla repayment", () => {
  const scenario = configureHouseScenario(createWorkbookScenario(), { together: true, ltv: 0.9, tesla: true });
  const result = runProjection(scenario);
  closeTo(result.house!.availableBeforePurchase, 37000.48);
  closeTo(result.house!.totalUpfrontCashRequired, 26000);
  closeTo(result.house!.availableAfterPurchase, 11000.48);
});

test("minimum liquidity and safe-to-invest use the full horizon", () => {
  const scenario = createWorkbookScenario();
  scenario.minimumLiquidityBuffer.value = 12000;
  const result = runProjection(scenario);
  assert.equal(result.minimumLiquidityMonth, "2026-12");
  closeTo(result.minimumAvailableLiquidity, 15500);
  closeTo(result.safeToInvest, 3500);
});

test("scenario comparison reports final and monthly differences", () => {
  const base = runProjection(createWorkbookScenario());
  const seniorScenario = cloneScenario(createWorkbookScenario(), "senior", "Senior");
  seniorScenario.senior.enabled = true;
  const comparison = compareProjectionResults(base, runProjection(seniorScenario));
  closeTo(comparison.finalLiquidityDelta, 10800);
  closeTo(comparison.monthlySavingsCapacityDelta, 200);
});

test("all representative application outputs match cached workbook values", () => {
  const checks = validateAgainstWorkbook();
  const failures = checks.filter((item) => !item.passed);
  assert.deepEqual(failures, []);
});
