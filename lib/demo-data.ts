import type { FlowData, Transaction } from "./types";

const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, "0");
const iso = (day: number) => `${year}-${month}-${String(day).padStart(2, "0")}`;

const recurringExpense = (
  id: string,
  name: string,
  amount: number,
  paymentDay: number,
  category: string,
  endDate?: string,
  spendingBudget = false,
): Transaction => ({
  id,
  name,
  amount,
  type: "expense",
  date: iso(Math.min(paymentDay, 28)),
  category,
  expenseKind: "fixed",
  fundId: "income",
  createdAt: new Date().toISOString(),
  recurrence: {
    frequency: "monthly",
    paymentDay,
    startDate: `${year}-01-01`,
    ...(endDate ? { endDate } : {}),
    ...(spendingBudget ? { spendingBudget: true } : {}),
  },
});

export const demoData: FlowData = {
  schemaVersion: 8,
  funds: [
    { id: "income", name: "Income", balance: 0, kind: "income", monthlyBalances: {}, cycleEntries: {} },
    { id: "available", name: "Available Cash", balance: 600, kind: "available" },
    { id: "savings", name: "Savings", balance: 7149, kind: "savings", accounts: [{ id: "savings-main", name: "Savings account", balance: 7149 }] },
    { id: "tax", name: "Tax Reserve", balance: 6709, kind: "tax", accounts: [{ id: "tax-main", name: "Tax account", balance: 6709 }] },
  ],
  salaryProfiles: [
    {
      id: "main-salary",
      name: "Main salary",
      usableMonthlyIncome: 3200,
      payday: 25,
      grossSalary: 5100,
      overtimeGrossRate: 43.06,
      averageOvertimeHours: 18,
      overtimeNetRatio: 0.62,
      thirteenthSalaryMonths: [6, 12],
      taxStrategy: "percentage",
      taxValue: 15,
      monthlyOvertime: {},
    },
  ],
  transactions: [
    recurringExpense("findomestic", "Findomestic", 300.4, 5, "Financing"),
    recurringExpense("tesla", "Tesla", 450, 8, "Car"),
    recurringExpense("gym", "Gym", 27, 2, "Wellbeing"),
    recurringExpense("watch", "Apple Watch", 25, 12, "Technology"),
    recurringExpense("macbook", "MacBook", 49, 5, "Technology", "2026-11-30"),
    recurringExpense("spotify", "Spotify", 12, 14, "Subscriptions"),
    recurringExpense("phone", "Phone", 10, 18, "Bills"),
    recurringExpense("imu", "IMU Extra", 122, 16, "Tax"),
    recurringExpense("electricity", "Electricity", 150, 20, "Home"),
    recurringExpense("amex", "Amex", 22, 9, "Finance"),
    recurringExpense("charging", "EV charging", 150, 22, "Car", undefined, true),
    recurringExpense("chatgpt", "ChatGPT", 23, 3, "Subscriptions"),
    recurringExpense("rackets", "Rackets", 38, 7, "Sport"),
    {
      id: "groceries",
      name: "Groceries",
      amount: 86.4,
      type: "expense",
      date: iso(Math.max(1, today.getDate() - 2)),
      category: "Lifestyle",
      expenseKind: "variable",
      fundId: "available",
      createdAt: new Date().toISOString(),
    },
    {
      id: "freelance",
      name: "Consulting project",
      amount: 640,
      type: "income",
      date: iso(Math.max(1, today.getDate() - 5)),
      category: "Extra income",
      fundId: "savings",
      createdAt: new Date().toISOString(),
    },
  ],
  settings: {
    currency: "EUR",
    locale: "en-IE",
    safetyBuffer: 500,
    monthlyLifestyleBudget: 600,
    expectedTaxBill: 9200,
  },
  frontaxEntries: [],
  frontaxYearAdjustments: {},
};
