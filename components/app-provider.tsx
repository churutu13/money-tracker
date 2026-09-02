"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { demoData } from "@/lib/demo-data";
import type { FlowData, FlowSettings, FrontaxEntry, FrontaxYearAdjustments, Fund, FundAccount, SalaryProfile, Transaction } from "@/lib/types";

type TransactionPreset = "default" | "fixed" | "amex";

type StoreContextValue = {
  data: FlowData;
  hydrated: boolean;
  addTransaction: (transaction: Transaction) => void;
  updateTransaction: (transaction: Transaction) => void;
  deleteTransaction: (id: string) => void;
  duplicateTransaction: (transaction: Transaction) => void;
  updateSettings: (settings: FlowSettings) => void;
  updateSalary: (profile: SalaryProfile) => void;
  addSalary: (profile: SalaryProfile) => void;
  deleteSalary: (id: string) => void;
  updateFund: (fund: Fund) => void;
  addFund: (fund: Fund) => void;
  deleteFund: (id: string) => void;
  updateFundAccount: (fundId: string, account: FundAccount) => void;
  addFundAccount: (fundId: string, account: FundAccount) => void;
  deleteFundAccount: (fundId: string, accountId: string) => void;
  saveFrontaxEntry: (entry: FrontaxEntry) => void;
  deleteFrontaxEntry: (id: string) => void;
  updateFrontaxYearAdjustments: (year: number, adjustments: FrontaxYearAdjustments) => void;
  resetDemo: () => void;
  replaceData: (data: FlowData) => void;
  editingTransaction: Transaction | null;
  transactionPreset: TransactionPreset;
  transactionSheetOpen: boolean;
  openTransactionSheet: (transaction?: Transaction, preset?: TransactionPreset) => void;
  closeTransactionSheet: () => void;
};

const StoreContext = createContext<StoreContextValue | null>(null);
const CURRENT_SCHEMA_VERSION = 8;
const STORAGE_KEY = "flow.cash-planner.v8";
const PREVIOUS_STORAGE_KEY = "flow.cash-planner.v7";
const V6_STORAGE_KEY = "flow.cash-planner.v6";
const V5_STORAGE_KEY = "flow.cash-planner.v5";
const V4_STORAGE_KEY = "flow.cash-planner.v4";
const V3_STORAGE_KEY = "flow.cash-planner.v3";
const V2_STORAGE_KEY = "flow.cash-planner.v2";
const LEGACY_STORAGE_KEY = "flow.cash-planner.v1";

function migrateData(input: FlowData): FlowData {
  const removedFundIds = new Set(input.funds.filter((fund) => fund.kind === "emergency" || fund.id === "emergency").map((fund) => fund.id));
  const funds = input.funds.filter((fund) => !removedFundIds.has(fund.id));
  const availableIndex = funds.findIndex((fund) => fund.kind === "available");
  const hasSavings = funds.some((fund) => fund.kind === "savings" || fund.id === "savings");
  const hasIncome = funds.some((fund) => fund.kind === "income" || fund.id === "income");
  if (!hasSavings) {
    const previousBalance = availableIndex >= 0 ? funds[availableIndex].balance : 7149;
    funds.push({ id: "savings", name: "Savings", balance: previousBalance, kind: "savings" });
    if (availableIndex >= 0) funds[availableIndex] = { ...funds[availableIndex], balance: input.settings.monthlyLifestyleBudget || 600 };
  }
  if (!hasIncome) funds.unshift({ id: "income", name: "Income", balance: 0, kind: "income", monthlyBalances: {}, cycleEntries: {} });
  const normalizedFunds = funds.map((fund) => {
    if (fund.kind === "income") {
      const cycleEntries = fund.cycleEntries ?? Object.fromEntries(Object.entries(fund.monthlyBalances ?? {}).map(([key, income]) => [key, { income, fixed: 0, lifestyle: 0 }]));
      return { ...fund, monthlyBalances: fund.monthlyBalances ?? {}, cycleEntries };
    }
    if (fund.kind !== "savings" && fund.kind !== "tax") return fund;
    const accounts = fund.accounts === undefined
      ? [{ id: `${fund.id}-main`, name: fund.kind === "tax" ? "Tax account" : "Savings account", balance: fund.balance }]
      : fund.accounts;
    return { ...fund, accounts, balance: accounts.reduce((sum, account) => sum + account.balance, 0) };
  });
  const replacementFundId = normalizedFunds.find((fund) => fund.kind === "available")?.id ?? normalizedFunds[0]?.id ?? "";
  const migratedData: FlowData = {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    funds: normalizedFunds,
    transactions: input.transactions.map((transaction) => {
      let migrated = transaction;
      if (removedFundIds.has(migrated.fundId) || (migrated.destinationFundId && removedFundIds.has(migrated.destinationFundId))) {
        migrated = {
          ...migrated,
          fundId: removedFundIds.has(migrated.fundId) ? replacementFundId : migrated.fundId,
          fundAccountId: removedFundIds.has(migrated.fundId) ? undefined : migrated.fundAccountId,
          destinationFundId: migrated.destinationFundId && removedFundIds.has(migrated.destinationFundId) ? undefined : migrated.destinationFundId,
          destinationFundAccountId: migrated.destinationFundId && removedFundIds.has(migrated.destinationFundId) ? undefined : migrated.destinationFundAccountId,
        };
      }
      if (!hasSavings && transaction.fundId === "available") {
        const lifestyle = transaction.expenseKind === "variable" || transaction.category === "Lifestyle";
        migrated = { ...migrated, fundId: lifestyle ? "available" : "savings" };
      }
      if (!hasIncome && migrated.type === "expense" && migrated.expenseKind !== "variable" && migrated.recurrence) {
        migrated = { ...migrated, fundId: "income", fundAccountId: undefined };
      }
      if (migrated.id === "charging" && migrated.recurrence && !migrated.recurrence.spendingBudget) {
        migrated = { ...migrated, recurrence: { ...migrated.recurrence, spendingBudget: true } };
      }
      return migrated.type === "expense" ? { ...migrated, paymentMethod: migrated.paymentMethod ?? "bank" } : migrated;
    }),
    salaryProfiles: input.salaryProfiles.map((salary) => ({ ...salary, monthlyOvertime: salary.monthlyOvertime ?? {} })),
    settings: input.settings,
    frontaxEntries: input.frontaxEntries ?? [],
    frontaxYearAdjustments: input.frontaxYearAdjustments ?? {},
  };

  if ((input.schemaVersion ?? 0) >= CURRENT_SCHEMA_VERSION) return migratedData;

  // Before schema v8, posted expenses linked to an already-allocated recurring
  // spending budget were also deducted from their fund. Restore those legacy
  // deductions once; future linked expenses are tracking-only fund movements.
  const today = new Date().toISOString().slice(0, 10);
  const legacyDeductions = migratedData.transactions.filter((transaction) =>
    transaction.type === "expense"
    && !transaction.recurrence
    && Boolean(transaction.recurringBudgetId)
    && transaction.date <= today
    && (transaction.paymentMethod !== "amex" || Boolean(transaction.amexReserved)));
  const restoredFunds = legacyDeductions.reduce(
    (funds, transaction) => funds.map((fund) => fund.id === transaction.fundId
      ? applyFundDelta(fund, transaction.amount, transaction.fundAccountId)
      : fund),
    migratedData.funds,
  );
  return { ...migratedData, funds: restoredFunds };
}

function applyFundDelta(fund: Fund, delta: number, accountId?: string) {
  if (fund.accounts === undefined) return { ...fund, balance: fund.balance + delta };
  const accounts = fund.accounts.length
    ? fund.accounts.map((account, index) => account.id === accountId || (!accountId && index === 0) ? { ...account, balance: account.balance + delta } : account)
    : [{ id: `${fund.id}-unallocated`, name: "Unallocated activity", balance: delta }];
  return { ...fund, accounts, balance: accounts.reduce((sum, account) => sum + account.balance, 0) };
}

function applyTransactionToFunds(funds: Fund[], transaction: Transaction, direction: 1 | -1) {
  const currentDate = new Date().toISOString().slice(0, 10);
  if (transaction.type === "expense" && transaction.recurringBudgetId) return funds;
  if (transaction.type === "expense" && transaction.paymentMethod === "amex" && transaction.recurrence) {
    const reservedOccurrences = (transaction.recurrence.amexReservedDates ?? []).filter((date) => date <= currentDate).length;
    if (!reservedOccurrences) return funds;
    return funds.map((fund) => fund.id === transaction.fundId
      ? applyFundDelta(fund, -transaction.amount * reservedOccurrences * direction, transaction.fundAccountId)
      : fund);
  }
  if (transaction.recurrence || transaction.date > currentDate) return funds;
  return funds.map((fund) => {
    if (transaction.type === "expense" && fund.id === transaction.fundId) {
      if (transaction.paymentMethod === "amex" && !transaction.amexReserved) return fund;
      return applyFundDelta(fund, -transaction.amount * direction, transaction.fundAccountId);
    }
    if (transaction.type === "income" && fund.id === transaction.fundId) return applyFundDelta(fund, transaction.amount * direction, transaction.fundAccountId);
    if (transaction.type === "transfer" && fund.id === transaction.fundId) return applyFundDelta(fund, -transaction.amount * direction, transaction.fundAccountId);
    if (transaction.type === "transfer" && fund.id === transaction.destinationFundId) return applyFundDelta(fund, transaction.amount * direction, transaction.destinationFundAccountId);
    return fund;
  });
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<FlowData>(demoData);
  const [hydrated, setHydrated] = useState(false);
  const [transactionSheetOpen, setTransactionSheetOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionPreset, setTransactionPreset] = useState<TransactionPreset>("default");

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(PREVIOUS_STORAGE_KEY) ?? localStorage.getItem(V6_STORAGE_KEY) ?? localStorage.getItem(V5_STORAGE_KEY) ?? localStorage.getItem(V4_STORAGE_KEY) ?? localStorage.getItem(V3_STORAGE_KEY) ?? localStorage.getItem(V2_STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
      if (stored) setData(migrateData(JSON.parse(stored) as FlowData));
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (hydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  const addTransaction = useCallback((transaction: Transaction) => {
    setData((current) => ({ ...current, funds: applyTransactionToFunds(current.funds, transaction, 1), transactions: [transaction, ...current.transactions] }));
  }, []);
  const updateTransaction = useCallback((transaction: Transaction) => {
    setData((current) => {
      const previous = current.transactions.find((item) => item.id === transaction.id);
      const reversed = previous ? applyTransactionToFunds(current.funds, previous, -1) : current.funds;
      const budgetDisabled = Boolean(previous?.recurrence?.spendingBudget) && !transaction.recurrence?.spendingBudget;
      return {
        ...current,
        funds: applyTransactionToFunds(reversed, transaction, 1),
        transactions: current.transactions.map((item) => item.id === transaction.id
          ? transaction
          : budgetDisabled && item.recurringBudgetId === transaction.id ? { ...item, recurringBudgetId: undefined } : item),
      };
    });
  }, []);
  const deleteTransaction = useCallback((id: string) => {
    setData((current) => {
      const previous = current.transactions.find((item) => item.id === id);
      return {
        ...current,
        funds: previous ? applyTransactionToFunds(current.funds, previous, -1) : current.funds,
        transactions: current.transactions.filter((item) => item.id !== id).map((item) => item.recurringBudgetId === id ? { ...item, recurringBudgetId: undefined } : item),
      };
    });
  }, []);
  const duplicateTransaction = useCallback((transaction: Transaction) => {
    addTransaction({
      ...transaction,
      id: crypto.randomUUID(),
      name: `${transaction.name} copy`,
      amexReserved: false,
      recurrence: transaction.recurrence ? { ...transaction.recurrence, amexReservedDates: undefined } : undefined,
      createdAt: new Date().toISOString(),
    });
  }, [addTransaction]);
  const updateSettings = useCallback((settings: FlowSettings) => setData((current) => ({ ...current, settings })), []);
  const updateSalary = useCallback((profile: SalaryProfile) => {
    setData((current) => ({ ...current, salaryProfiles: current.salaryProfiles.map((item) => item.id === profile.id ? profile : item) }));
  }, []);
  const addSalary = useCallback((profile: SalaryProfile) => setData((current) => ({ ...current, salaryProfiles: [...current.salaryProfiles, profile] })), []);
  const deleteSalary = useCallback((id: string) => setData((current) => ({ ...current, salaryProfiles: current.salaryProfiles.filter((item) => item.id !== id) })), []);
  const updateFund = useCallback((fund: Fund) => setData((current) => ({ ...current, funds: current.funds.map((item) => item.id === fund.id ? fund : item) })), []);
  const addFund = useCallback((fund: Fund) => setData((current) => ({ ...current, funds: [...current.funds, fund] })), []);
  const deleteFund = useCallback((id: string) => setData((current) => {
    const replacement = current.funds.find((item) => item.kind === "available")?.id ?? current.funds.find((item) => item.id !== id)?.id ?? "";
    return { ...current, funds: current.funds.filter((item) => item.id !== id), transactions: current.transactions.map((item) => ({ ...item, fundId: item.fundId === id ? replacement : item.fundId, fundAccountId: item.fundId === id ? undefined : item.fundAccountId, destinationFundId: item.destinationFundId === id ? undefined : item.destinationFundId, destinationFundAccountId: item.destinationFundId === id ? undefined : item.destinationFundAccountId })) };
  }), []);
  const updateFundAccount = useCallback((fundId: string, account: FundAccount) => setData((current) => ({
    ...current,
    funds: current.funds.map((fund) => {
      if (fund.id !== fundId) return fund;
      const accounts = (fund.accounts ?? []).map((item) => item.id === account.id ? account : item);
      return { ...fund, accounts, balance: accounts.reduce((sum, item) => sum + item.balance, 0) };
    }),
  })), []);
  const addFundAccount = useCallback((fundId: string, account: FundAccount) => setData((current) => ({
    ...current,
    funds: current.funds.map((fund) => {
      if (fund.id !== fundId) return fund;
      const accounts = [...(fund.accounts ?? []), account];
      return { ...fund, accounts, balance: accounts.reduce((sum, item) => sum + item.balance, 0) };
    }),
  })), []);
  const deleteFundAccount = useCallback((fundId: string, accountId: string) => setData((current) => ({
    ...current,
    funds: current.funds.map((fund) => {
      if (fund.id !== fundId) return fund;
      const accounts = (fund.accounts ?? []).filter((account) => account.id !== accountId);
      return { ...fund, accounts, balance: accounts.reduce((sum, item) => sum + item.balance, 0) };
    }),
    transactions: current.transactions.map((transaction) => ({
      ...transaction,
      fundAccountId: transaction.fundId === fundId && transaction.fundAccountId === accountId ? undefined : transaction.fundAccountId,
      destinationFundAccountId: transaction.destinationFundId === fundId && transaction.destinationFundAccountId === accountId ? undefined : transaction.destinationFundAccountId,
    })),
  })), []);
  const saveFrontaxEntry = useCallback((entry: FrontaxEntry) => setData((current) => {
    const entries = current.frontaxEntries ?? [];
    const sameMonth = (item: FrontaxEntry) => item.id === entry.id || (item.year === entry.year && item.month === entry.month);
    return { ...current, frontaxEntries: entries.some(sameMonth) ? entries.map((item) => sameMonth(item) ? entry : item) : [...entries, entry] };
  }), []);
  const deleteFrontaxEntry = useCallback((id: string) => setData((current) => ({ ...current, frontaxEntries: (current.frontaxEntries ?? []).filter((entry) => entry.id !== id) })), []);
  const updateFrontaxYearAdjustments = useCallback((year: number, adjustments: FrontaxYearAdjustments) => setData((current) => ({
    ...current,
    frontaxYearAdjustments: { ...(current.frontaxYearAdjustments ?? {}), [String(year)]: adjustments },
  })), []);
  const resetDemo = useCallback(() => setData(demoData), []);
  const replaceData = useCallback((nextData: FlowData) => setData(migrateData(nextData)), []);
  const openTransactionSheet = useCallback((transaction?: Transaction, preset: TransactionPreset = "default") => {
    setEditingTransaction(transaction ?? null);
    setTransactionPreset(preset);
    setTransactionSheetOpen(true);
  }, []);
  const closeTransactionSheet = useCallback(() => {
    setTransactionSheetOpen(false);
    setTimeout(() => { setEditingTransaction(null); setTransactionPreset("default"); }, 220);
  }, []);

  const value = useMemo(() => ({
    data,
    hydrated,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    duplicateTransaction,
    updateSettings,
    updateSalary,
    addSalary,
    deleteSalary,
    updateFund,
    addFund,
    deleteFund,
    updateFundAccount,
    addFundAccount,
    deleteFundAccount,
    saveFrontaxEntry,
    deleteFrontaxEntry,
    updateFrontaxYearAdjustments,
    resetDemo,
    replaceData,
    editingTransaction,
    transactionPreset,
    transactionSheetOpen,
    openTransactionSheet,
    closeTransactionSheet,
  }), [data, hydrated, addTransaction, updateTransaction, deleteTransaction, duplicateTransaction, updateSettings, updateSalary, addSalary, deleteSalary, updateFund, addFund, deleteFund, updateFundAccount, addFundAccount, deleteFundAccount, saveFrontaxEntry, deleteFrontaxEntry, updateFrontaxYearAdjustments, resetDemo, replaceData, editingTransaction, transactionPreset, transactionSheetOpen, openTransactionSheet, closeTransactionSheet]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useFlow() {
  const context = useContext(StoreContext);
  if (!context) throw new Error("useFlow must be used inside AppProvider");
  return context;
}
