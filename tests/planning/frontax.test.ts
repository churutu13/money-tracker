import assert from "node:assert/strict";
import test from "node:test";
import { calculateFrontax, calculateItalianTaxBeforeDeductions, forecastFrontax, monthlyFrontaxRecommendation } from "../../lib/frontax";
import type { FrontaxEntry } from "../../lib/types";

const entry = (year: number, taxableIncome: number): FrontaxEntry => ({
  id: "test", year, month: 1, grossIncomeChf: taxableIncome + 10_000,
  netIncomeChf: taxableIncome + 10_000, socialContributionsChf: 0,
  taxAtSourceChf: 0, exchangeRate: 1, updatedAt: "",
});
const close = (actual: number, expected: number) => assert.ok(Math.abs(actual - expected) < 0.000001, `${actual} != ${expected}`);

test("IRPEF reduction follows fiscal year and bracket boundaries", () => {
  for (const [income, reduction] of [[0, 0], [15000, 0], [28000, 0], [28001, 0.02], [40000, 240], [50000, 440], [50001, 440], [60000, 440]]) {
    const previous = calculateItalianTaxBeforeDeductions([entry(2025, income)]);
    for (const year of [2026, 2027]) {
      close(previous.estimatedItalianTax - calculateItalianTaxBeforeDeductions([entry(year, income)]).estimatedItalianTax, reduction);
      close(calculateFrontax([entry(2025, income)]).estimatedItalianTax - calculateFrontax([entry(year, income)]).estimatedItalianTax, reduction);
    }
    close(calculateItalianTaxBeforeDeductions([entry(2024, income)]).estimatedItalianTax, previous.estimatedItalianTax);
  }
});

test("explicit fiscal year controls both tax calculations", () => {
  const entries = [entry(2025, 50000)];
  // 13,700 IRPEF + 768.3 regional + 175 municipal.
  close(calculateItalianTaxBeforeDeductions(entries, 2026).estimatedItalianTax, 14643.3);
  close(calculateFrontax(entries, undefined, 2026).estimatedItalianTax, 14643.3);
  close(calculateFrontax(entries, undefined, 2025).estimatedItalianTax, 15083.3);
});

test("forecast and monthly reserves use the reduced rate", () => {
  const reserves = [2025, 2026].map((year) => {
    const payslip = { ...entry(year, 50000), grossIncomeChf: 5000, netIncomeChf: 5000 };
    const forecast = forecastFrontax([payslip], year, undefined, new Date(year, 0, 15));
    close(forecast.projectedResult.taxableIncome, 50000);
    close(monthlyFrontaxRecommendation(forecast.projectedEntries, payslip), forecast.projectedReserve / 12);
    return forecast.projectedReserve;
  });
  close(reserves[0] - reserves[1], 880);
});
