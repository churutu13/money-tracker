import type { FlowData, Transaction } from "../types";
import { createWorkbookScenario } from "./assumptions";
import type { FinancialScenario, PlanningActualsSnapshot, RecurringPlanningExpense } from "./types";

const normalize = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

function actualExpense(transaction: Transaction): RecurringPlanningExpense {
  return {
    id: transaction.id,
    name: transaction.name,
    amount: {
      id: `${transaction.id}-amount`,
      label: transaction.name,
      value: transaction.amount,
      unit: "EUR/month",
      status: "actual",
      source: "Flow recurring transaction",
    },
    startMonth: transaction.recurrence!.startDate.slice(0, 7),
    endMonth: transaction.recurrence?.endDate?.slice(0, 7),
    kind: normalize(transaction.name).includes("tesla") || normalize(transaction.name).includes("findomestic") ? "debt" : "recurring",
    alreadyIncludedInFlow: true,
  };
}

export function planningActualsFromFlow(data: FlowData): PlanningActualsSnapshot {
  const savings = data.funds.filter((fund) => fund.kind === "savings").reduce((sum, fund) => sum + fund.balance, 0);
  const taxReserve = data.funds.filter((fund) => fund.kind === "tax").reduce((sum, fund) => sum + fund.balance, 0);
  const recurringExpenses = data.transactions
    .filter((transaction) => transaction.type === "expense" && transaction.recurrence)
    .map(actualExpense);
  return {
    availableLiquidity: savings,
    taxReserve,
    salary: data.salaryProfiles.find((profile) => profile.usableMonthlyIncome > 0)?.usableMonthlyIncome,
    recurringExpenses,
    sourceData: data,
  };
}

export function applyFlowActuals(scenario: FinancialScenario, data: FlowData): FinancialScenario {
  const actuals = planningActualsFromFlow(data);
  const actualById = new Map(actuals.recurringExpenses.map((item) => [item.id, item]));
  const actualByName = new Map(actuals.recurringExpenses.map((item) => [normalize(item.name), item]));
  const consumed = new Set<string>();
  const recurringExpenses = scenario.recurringExpenses.map((modelItem) => {
    const actual = actualById.get(modelItem.id) ?? actualByName.get(normalize(modelItem.name));
    if (!actual) return modelItem;
    consumed.add(actual.id);
    return actual;
  });
  recurringExpenses.push(...actuals.recurringExpenses.filter((item) => !consumed.has(item.id)));
  return {
    ...structuredClone(scenario),
    updatedAt: new Date().toISOString(),
    openingTaxReserve: { ...scenario.openingTaxReserve, value: actuals.taxReserve || scenario.openingTaxReserve.value, status: actuals.taxReserve ? "actual" : scenario.openingTaxReserve.status, source: actuals.taxReserve ? "Flow tax fund" : scenario.openingTaxReserve.source },
    monthlyNetIncome: actuals.salary ? { ...scenario.monthlyNetIncome, value: actuals.salary, status: "actual", source: "Flow salary profile" } : scenario.monthlyNetIncome,
    recurringExpenses,
  };
}

export function createFlowPlanningScenario(data: FlowData) {
  return applyFlowActuals(createWorkbookScenario("flow-current", "Flow current"), data);
}
