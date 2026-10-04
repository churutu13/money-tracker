import type { FrontaxEntry, FrontaxYearAdjustments } from "./types";

export type FrontaxTaxResult = {
  estimatedItalianTax: number;
  taxableIncome: number;
  sourceTaxCredit: number;
  employmentDeduction: number;
  additionalEmploymentDeduction: number;
  otherDeductions: number;
  balanceDue: number;
  nextYearAdvance: number;
  totalCashToReserve: number;
};

const NO_ADJUSTMENTS: FrontaxYearAdjustments = { deductionsEur: 0, priorAdvancesEur: 0 };

const safeRate = (rate: number) => Math.max(0.0001, rate || 0.937);
const entryKey = (entry: Pick<FrontaxEntry, "year" | "month">) => `${entry.year}-${String(entry.month).padStart(2, "0")}`;

function grossItalianTax(taxableIncome: number, fiscalYear: number) {
  // Legge 199/2025, art. 1, comma 3: second bracket reduced from 2026.
  const secondBracketRate = fiscalYear >= 2026 ? 0.33 : 0.35;
  if (taxableIncome <= 28_000) return taxableIncome * 0.23;
  if (taxableIncome <= 50_000) return 28_000 * 0.23 + (taxableIncome - 28_000) * secondBracketRate;
  return 28_000 * 0.23 + 22_000 * secondBracketRate + (taxableIncome - 50_000) * 0.43;
}

function employmentDeduction(taxableIncome: number) {
  let deduction = 0;
  if (taxableIncome <= 15_000) deduction = 1_955;
  else if (taxableIncome <= 28_000) deduction = 1_910 + 1_190 * ((28_000 - taxableIncome) / 13_000);
  else if (taxableIncome <= 50_000) deduction = 1_910 * ((50_000 - taxableIncome) / 22_000);
  if (taxableIncome > 25_000 && taxableIncome <= 35_000) deduction += 65;
  return deduction;
}

function additionalEmploymentDeduction(taxableIncome: number, fiscalYear: number) {
  if (fiscalYear < 2025 || taxableIncome <= 20_000 || taxableIncome > 40_000) return 0;
  if (taxableIncome <= 32_000) return 1_000;
  return 1_000 * ((40_000 - taxableIncome) / 8_000);
}

function lombardyAdditionalTax(taxableIncome: number) {
  if (taxableIncome <= 15_000) return taxableIncome * 0.0123;
  if (taxableIncome <= 28_000) return 15_000 * 0.0123 + (taxableIncome - 15_000) * 0.0158;
  if (taxableIncome <= 50_000) return 15_000 * 0.0123 + 13_000 * 0.0158 + (taxableIncome - 28_000) * 0.0172;
  return 15_000 * 0.0123 + 13_000 * 0.0158 + 22_000 * 0.0172 + (taxableIncome - 50_000) * 0.0173;
}

export function calculateFrontax(entries: FrontaxEntry[], adjustments: FrontaxYearAdjustments = NO_ADJUSTMENTS, fiscalYear = entries[0]?.year ?? new Date().getFullYear()): FrontaxTaxResult {
  const incomeAfterSocialEur = entries.reduce((sum, entry) => sum + Math.max(0, entry.grossIncomeChf - entry.socialContributionsChf) / safeRate(entry.exchangeRate), 0);
  const sourceTaxCredit = entries.reduce((sum, entry) => sum + entry.taxAtSourceChf * 1.07, 0);
  const taxableIncome = Math.max(0, incomeAfterSocialEur - 10_000);
  const workDeduction = employmentDeduction(taxableIncome);
  const additionalWorkDeduction = additionalEmploymentDeduction(taxableIncome, fiscalYear);
  const otherDeductions = Math.max(0, adjustments.deductionsEur || 0);
  const beforeAdditionals = grossItalianTax(taxableIncome, fiscalYear) - workDeduction - additionalWorkDeduction - otherDeductions - sourceTaxCredit;
  const estimatedItalianTax = Math.max(0, beforeAdditionals + lombardyAdditionalTax(taxableIncome) + taxableIncome * 0.0035);
  const balanceDue = Math.max(0, estimatedItalianTax - Math.max(0, adjustments.priorAdvancesEur || 0));
  const nextYearAdvance = estimatedItalianTax;
  const totalCashToReserve = balanceDue + nextYearAdvance;
  return { estimatedItalianTax, taxableIncome, sourceTaxCredit, employmentDeduction: workDeduction, additionalEmploymentDeduction: additionalWorkDeduction, otherDeductions, balanceDue, nextYearAdvance, totalCashToReserve };
}

export function calculateItalianTaxBeforeDeductions(entries: FrontaxEntry[], fiscalYear = entries[0]?.year ?? new Date().getFullYear()) {
  const incomeAfterSocialEur = entries.reduce((sum, entry) => sum + Math.max(0, entry.grossIncomeChf - entry.socialContributionsChf) / safeRate(entry.exchangeRate), 0);
  const taxableIncome = Math.max(0, incomeAfterSocialEur - 10_000);
  return {
    taxableIncome,
    estimatedItalianTax: grossItalianTax(taxableIncome, fiscalYear) + lombardyAdditionalTax(taxableIncome) + taxableIncome * 0.0035,
  };
}

export function frontaxEntriesForYear(entries: FrontaxEntry[] | undefined, year: number) {
  return (entries ?? []).filter((entry) => entry.year === year).sort((a, b) => a.month - b.month);
}

export function monthlyFrontaxRecommendation(entries: FrontaxEntry[], selected: Pick<FrontaxEntry, "year" | "month">, adjustments: FrontaxYearAdjustments = NO_ADJUSTMENTS) {
  const ordered = frontaxEntriesForYear(entries, selected.year);
  const entry = ordered.find((item) => entryKey(item) === entryKey(selected));
  if (!entry || !ordered.length) return 0;
  const totalTax = calculateFrontax(ordered, adjustments, selected.year).totalCashToReserve;
  const totalNet = ordered.reduce((sum, item) => sum + item.netIncomeChf / safeRate(item.exchangeRate), 0);
  if (totalNet > 0) return totalTax * ((entry.netIncomeChf / safeRate(entry.exchangeRate)) / totalNet);
  const totalGross = ordered.reduce((sum, item) => sum + item.grossIncomeChf / safeRate(item.exchangeRate), 0);
  if (totalGross > 0) return totalTax * ((entry.grossIncomeChf / safeRate(entry.exchangeRate)) / totalGross);
  return totalTax / ordered.length;
}

export function projectedMonthlySetAside(entries: FrontaxEntry[], selected: Pick<FrontaxEntry, "year" | "month">, totalCashTarget: number) {
  const ordered = frontaxEntriesForYear(entries, selected.year);
  const entry = ordered.find((item) => entryKey(item) === entryKey(selected));
  if (!entry || !ordered.length || totalCashTarget <= 0) return 0;
  const totalNetEur = ordered.reduce((sum, item) => sum + Math.max(0, item.netIncomeChf) / safeRate(item.exchangeRate), 0);
  if (totalNetEur > 0) return totalCashTarget * ((Math.max(0, entry.netIncomeChf) / safeRate(entry.exchangeRate)) / totalNetEur);
  const totalGrossEur = ordered.reduce((sum, item) => sum + Math.max(0, item.grossIncomeChf) / safeRate(item.exchangeRate), 0);
  if (totalGrossEur > 0) return totalCashTarget * ((Math.max(0, entry.grossIncomeChf) / safeRate(entry.exchangeRate)) / totalGrossEur);
  return totalCashTarget / ordered.length;
}

export function frontaxReserveProgress(entries: FrontaxEntry[], totalCashTarget: number, throughMonth: number) {
  const ordered = [...entries].sort((a, b) => a.month - b.month);
  const monthly = ordered.map((entry) => ({ entry, amount: projectedMonthlySetAside(ordered, entry, totalCashTarget) }));
  const recommendedToDate = monthly.filter(({ entry }) => entry.month <= throughMonth).reduce((sum, item) => sum + item.amount, 0);
  return {
    annualTarget: totalCashTarget,
    recommendedToDate,
    remainingAfterMonth: Math.max(0, totalCashTarget - recommendedToDate),
  };
}

export function forecastFrontax(entries: FrontaxEntry[], year: number, adjustments: FrontaxYearAdjustments = NO_ADJUSTMENTS, today = new Date()) {
  const actual = frontaxEntriesForYear(entries, year);
  const currentResult = calculateFrontax(actual, adjustments, year);
  const currentTax = currentResult.estimatedItalianTax;
  const currentReserve = currentResult.totalCashToReserve;
  const firstFutureMonth = year === today.getFullYear() ? today.getMonth() + 2 : year > today.getFullYear() ? 1 : 13;
  const existingMonths = new Set(actual.map((entry) => entry.month));
  const futureMonths = Array.from({ length: 12 }, (_, index) => index + 1).filter((month) => month >= firstFutureMonth && !existingMonths.has(month));
  if (!actual.length || !futureMonths.length) return { projectedEntries: actual, projectedResult: currentResult, projectedTax: currentTax, projectedReserve: currentReserve, additionalMonthlyReserve: 0, futureMonthCount: futureMonths.length };

  const average = <K extends keyof Pick<FrontaxEntry, "grossIncomeChf" | "netIncomeChf" | "socialContributionsChf" | "taxAtSourceChf" | "exchangeRate">>(field: K) => actual.reduce((sum, entry) => sum + entry[field], 0) / actual.length;
  const projected = futureMonths.map((month): FrontaxEntry => ({
    id: `forecast-${year}-${month}`,
    year,
    month,
    grossIncomeChf: average("grossIncomeChf"),
    netIncomeChf: average("netIncomeChf"),
    socialContributionsChf: average("socialContributionsChf"),
    taxAtSourceChf: average("taxAtSourceChf"),
    exchangeRate: average("exchangeRate"),
    updatedAt: "",
  }));
  const projectedEntries = [...actual, ...projected].sort((a, b) => a.month - b.month);
  const projectedResult = calculateFrontax(projectedEntries, adjustments, year);
  const projectedTax = projectedResult.estimatedItalianTax;
  return { projectedEntries, projectedResult, projectedTax, projectedReserve: projectedResult.totalCashToReserve, additionalMonthlyReserve: Math.max(0, projectedResult.totalCashToReserve - currentReserve) / futureMonths.length, futureMonthCount: futureMonths.length };
}
