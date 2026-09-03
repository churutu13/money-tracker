import { cloneScenario, createWorkbookScenario } from "./assumptions";
import { runProjection } from "./projection-engine";
import type { FinancialScenario } from "./types";

export interface WorkbookValidationCheck {
  scenario: string;
  metric: string;
  expected: number;
  actual: number;
  difference: number;
  tolerance: number;
  passed: boolean;
}

const CORE_TARGETS = {
  Base: { 2026: 15500, 2027: 17093.36, 2028: 37000.48, 2029: 57477.12, 2030: 77953.76, 2031: 98430.4 },
  Senior: { 2026: 15500, 2027: 18293.36, 2028: 40600.48, 2029: 63477.12, 2030: 86353.76, 2031: 109230.4 },
  Cohabitation: { 2026: 15500, 2027: 17093.36, 2028: 34000.48, 2029: 51477.12, 2030: 68953.76, 2031: 86430.4 },
  "Senior + Cohabitation": { 2026: 15500, 2027: 18293.36, 2028: 37600.48, 2029: 57477.12, 2030: 77353.76, 2031: 97230.4 },
  "Base + Tesla partial": { 2026: 15500, 2027: 17093.36, 2028: 27000.48, 2029: 51005.12, 2030: 75009.76, 2031: 99014.4 },
} as const;

const HOUSE_TARGETS = [
  { name: "House alone 80%", senior: false, together: false, ltv: 0.8, tesla: false, post: -2999.52, payment: 600.7482843114, liquidity2031: 17003.4617647899, equity2031: 39503.2919795068 },
  { name: "House alone 80% + Tesla", senior: false, together: false, ltv: 0.8, tesla: true, post: -12999.52, payment: 600.7482843114, liquidity2031: 17587.4617647899, equity2031: 39503.2919795068 },
  { name: "House alone 90%", senior: false, together: false, ltv: 0.9, tesla: false, post: 12000.48, payment: 675.8418198503, liquidity2031: 29300.0944853886, equity2031: 25691.2034769451 },
  { name: "House alone 90% + Tesla", senior: false, together: false, ltv: 0.9, tesla: true, post: 2000.48, payment: 675.8418198503, liquidity2031: 29884.0944853886, equity2031: 25691.2034769451 },
  { name: "House together 80%", senior: false, together: true, ltv: 0.8, tesla: false, post: 11000.48, payment: 400.4988562076, liquidity2031: 47212.4411765266, equity2031: 26335.5279863378 },
  { name: "House together 90%", senior: false, together: true, ltv: 0.9, tesla: false, post: 21000.48, payment: 450.5612132335, liquidity2031: 55410.1963235924, equity2031: 17127.4689846301 },
  { name: "Senior house together 80%", senior: true, together: true, ltv: 0.8, tesla: false, post: 14600.48, payment: 400.4988562076, liquidity2031: 58012.4411765266, equity2031: 26335.5279863378 },
  { name: "Senior house together 90% + Tesla", senior: true, together: true, ltv: 0.9, tesla: true, post: 14600.48, payment: 450.5612132335, liquidity2031: 66794.1963235924, equity2031: 17127.4689846301 },
] as const;

function scenarioForCore(name: keyof typeof CORE_TARGETS) {
  const scenario = createWorkbookScenario(normalizeId(name), name);
  scenario.senior.enabled = name.includes("Senior");
  scenario.livingTogether.enabled = name.includes("Cohabitation");
  scenario.teslaPartialRepayment.enabled = name.includes("Tesla");
  return scenario;
}

function normalizeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function configureHouseScenario(base: FinancialScenario, options: { together: boolean; ltv: number; tesla: boolean; senior?: boolean; name?: string }) {
  const scenario = cloneScenario(base, normalizeId(options.name ?? "house-scenario"), options.name ?? "House scenario");
  scenario.senior.enabled = Boolean(options.senior);
  scenario.teslaPartialRepayment.enabled = options.tesla;
  scenario.housing.enabled = true;
  scenario.housing.buying = options.together ? "together" : "alone";
  scenario.housing.purchasePrice.value = options.together ? 200000 : 150000;
  scenario.housing.ownershipShare.value = options.together ? 0.5 : 1;
  scenario.housing.purchaseCosts.value = options.together ? 12000 : 10000;
  scenario.housing.additionalLivingCosts.value = options.together ? 300 : 550;
  scenario.housing.mortgage.ltv.value = options.ltv;
  return scenario;
}

function check(scenario: string, metric: string, expected: number, actual: number, tolerance = 0.01): WorkbookValidationCheck {
  const difference = actual - expected;
  return { scenario, metric, expected, actual, difference, tolerance, passed: Math.abs(difference) <= tolerance };
}

export function validateAgainstWorkbook() {
  const checks: WorkbookValidationCheck[] = [];
  for (const [name, targets] of Object.entries(CORE_TARGETS) as [keyof typeof CORE_TARGETS, (typeof CORE_TARGETS)[keyof typeof CORE_TARGETS]][]) {
    const result = runProjection(scenarioForCore(name));
    const actualByYear = new Map(result.yearly.map((item) => [item.year, item.liquidity]));
    for (const [year, expected] of Object.entries(targets)) checks.push(check(name, `${year} liquidity`, expected, actualByYear.get(Number(year)) ?? Number.NaN));
  }
  for (const target of HOUSE_TARGETS) {
    const scenario = configureHouseScenario(createWorkbookScenario(), { ...target, name: target.name });
    const result = runProjection(scenario);
    checks.push(check(target.name, "post-purchase liquidity", target.post, result.house?.availableAfterPurchase ?? Number.NaN));
    checks.push(check(target.name, "monthly mortgage share", target.payment, result.house?.userMortgagePayment ?? Number.NaN));
    checks.push(check(target.name, "2031 liquidity", target.liquidity2031, result.finalMonth.closingAvailableLiquidity));
    checks.push(check(target.name, "2031 home equity", target.equity2031, result.finalMonth.homeEquity));
  }
  return checks;
}

export function workbookValidationSummary() {
  const checks = validateAgainstWorkbook();
  return { checks, passed: checks.filter((item) => item.passed).length, failed: checks.filter((item) => !item.passed).length };
}
