"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import {
  demoAccounts,
  demoBuckets,
  demoBudget,
  demoReceivables,
  demoRecurring,
  demoTaxFunds,
  demoTransactions,
} from "@/lib/demo-data";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import type {
  Account,
  BudgetItem,
  Bucket,
  Receivable,
  RecurringItem,
  TaxFund,
  Transaction,
} from "@/lib/types";

interface FinanceState {
  accounts: Account[];
  transactions: Transaction[];
  budget: BudgetItem[];
  recurring: RecurringItem[];
  taxFunds: TaxFund[];
  receivables: Receivable[];
  buckets: Bucket[];
}

type New<T extends { id: string }> = Omit<T, "id">;

interface FinanceContextValue extends FinanceState {
  loading: boolean;
  authLoading: boolean;
  demoMode: boolean;
  user: User | null;
  selectedMonth: string;
  setSelectedMonth: (month: string) => void;
  refresh: () => Promise<void>;
  seed: () => Promise<void>;
  addAccount: (value: New<Account>) => Promise<void>;
  updateAccount: (id: string, value: Partial<Account>) => Promise<void>;
  reconcileAccount: (id: string, balance: number, note?: string) => Promise<void>;
  removeAccount: (id: string) => Promise<void>;
  addTransaction: (value: New<Transaction>) => Promise<void>;
  updateTransaction: (id: string, value: Partial<Transaction>) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  addBudgetItem: (value: New<BudgetItem>) => Promise<void>;
  updateBudgetItem: (id: string, value: Partial<BudgetItem>) => Promise<void>;
  removeBudgetItem: (id: string) => Promise<void>;
  markBudgetPaid: (id: string, accountId: string, paidDate: string) => Promise<void>;
  duplicateBudget: (targetMonth: string) => Promise<void>;
  addRecurring: (value: New<RecurringItem>) => Promise<void>;
  updateRecurring: (id: string, value: Partial<RecurringItem>) => Promise<void>;
  removeRecurring: (id: string) => Promise<void>;
  addTaxFund: (value: New<TaxFund>) => Promise<void>;
  updateTaxFund: (id: string, value: Partial<TaxFund>) => Promise<void>;
  removeTaxFund: (id: string) => Promise<void>;
  addReceivable: (value: New<Receivable>) => Promise<void>;
  updateReceivable: (id: string, value: Partial<Receivable>) => Promise<void>;
  removeReceivable: (id: string) => Promise<void>;
  recordReceivablePayment: (id: string, amount: number, accountId: string, date: string) => Promise<void>;
  addBucket: (value: New<Bucket> & { account_id?: string }) => Promise<void>;
}

const initialState: FinanceState = {
  accounts: demoAccounts,
  transactions: demoTransactions,
  budget: demoBudget,
  recurring: demoRecurring,
  taxFunds: demoTaxFunds,
  receivables: demoReceivables,
  buckets: demoBuckets,
};

const FinanceContext = createContext<FinanceContextValue | null>(null);
const supabase = createClient();
const LOCAL_STORAGE_KEY = "denaro-personal-v2";

function createId(prefix: string) {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  const bytes = new Uint8Array(16);
  if (typeof globalThis.crypto?.getRandomValues === "function") {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const uuid = `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
  return `${prefix}-${uuid}`;
}

export function FinanceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<FinanceState>(initialState);
  const [selectedMonth, setSelectedMonth] = useState("2026-08-01");
  const [loading, setLoading] = useState(hasSupabaseEnv);
  const [authLoading, setAuthLoading] = useState(hasSupabaseEnv);
  const [user, setUser] = useState<User | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);
    await supabase.rpc("ensure_recurring_budget", { target_month: selectedMonth });
    const [accounts, transactions, budget, recurring, taxFunds, receivables, buckets] =
      await Promise.all([
        supabase.from("accounts").select("*").order("sort_order"),
        supabase.from("transactions").select("*").order("transaction_date", { ascending: false }).limit(250),
        supabase
          .from("budget_items")
          .select("*, budget_item_tags(tags(name))")
          .gte("expected_date", selectedMonth)
          .lt(
            "expected_date",
            new Date(
              new Date(`${selectedMonth}T12:00:00`).getFullYear(),
              new Date(`${selectedMonth}T12:00:00`).getMonth() + 1,
              1
            ).toISOString().slice(0, 10)
          )
          .order("expected_date"),
        supabase.from("recurring_items").select("*").order("payment_day"),
        supabase.from("tax_funds").select("*").order("reference_period", { ascending: false }),
        supabase.from("receivables").select("*").order("created_at", { ascending: false }),
        supabase
          .from("savings_buckets")
          .select("*, bucket_allocations(amount)")
          .order("created_at"),
      ]);

    const errors = [accounts, transactions, budget, recurring, taxFunds, receivables, buckets]
      .map((result) => result.error)
      .filter(Boolean);
    if (errors.length) {
      toast.error("Impossibile caricare alcuni dati", { description: errors[0]?.message });
    }

    setState({
      accounts: (accounts.data ?? []) as Account[],
      transactions: (transactions.data ?? []) as Transaction[],
      budget: ((budget.data ?? []) as unknown as Array<BudgetItem & { budget_item_tags?: Array<{ tags: { name: string } | null }> }>).map(
        (item) => ({
          ...item,
          tag_names: item.budget_item_tags?.flatMap((row) => (row.tags?.name ? [row.tags.name] : [])) ?? [],
        })
      ),
      recurring: (recurring.data ?? []) as RecurringItem[],
      taxFunds: (taxFunds.data ?? []) as TaxFund[],
      receivables: (receivables.data ?? []) as Receivable[],
      buckets: ((buckets.data ?? []) as unknown as Array<Bucket & { bucket_allocations?: Array<{ amount: number }> }>).map(
        (bucket) => ({
          ...bucket,
          allocated: bucket.bucket_allocations?.reduce((sum, row) => sum + row.amount, 0) ?? 0,
        })
      ),
    });
    setLoading(false);
  }, [selectedMonth]);

  useEffect(() => {
    if (!supabase) {
      localStorage.removeItem("denaro-demo-v1");
      const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (saved) {
        try {
          const restored = JSON.parse(saved) as FinanceState;
          queueMicrotask(() => setState(restored));
        } catch {
          localStorage.removeItem(LOCAL_STORAGE_KEY);
        }
      }
      return;
    }

    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setAuthLoading(false);
      if (data.user) void refresh();
      else setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
      if (session?.user) void refresh();
    });
    return () => data.subscription.unsubscribe();
  }, [refresh]);

  useEffect(() => {
    if (!supabase) localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (supabase && user) queueMicrotask(() => void refresh());
  }, [selectedMonth, refresh, user]);

  const insert = useCallback(
    async <T extends { id: string }>(table: string, key: keyof FinanceState, value: New<T>, prefix: string) => {
      if (!supabase) {
        setState((prev) => ({ ...prev, [key]: [...(prev[key] as unknown as T[]), { ...value, id: createId(prefix) }] }));
        toast.success("Salvato");
        return;
      }
      const { error } = await supabase.from(table).insert(value as never);
      if (error) throw error;
      await refresh();
      toast.success("Salvato");
    },
    [refresh]
  );

  const update = useCallback(
    async <T extends { id: string }>(table: string, key: keyof FinanceState, id: string, value: Partial<T>) => {
      if (!supabase) {
        setState((prev) => ({
          ...prev,
          [key]: (prev[key] as unknown as T[]).map((item) => (item.id === id ? { ...item, ...value } : item)),
        }));
        toast.success("Modifiche salvate");
        return;
      }
      const { error } = await supabase.from(table).update(value as never).eq("id", id);
      if (error) throw error;
      await refresh();
      toast.success("Modifiche salvate");
    },
    [refresh]
  );

  const remove = useCallback(
    async <T extends { id: string }>(table: string, key: keyof FinanceState, id: string) => {
      if (!supabase) {
        setState((prev) => ({ ...prev, [key]: (prev[key] as unknown as T[]).filter((item) => item.id !== id) }));
        toast.success("Eliminato");
        return;
      }
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      await refresh();
      toast.success("Eliminato");
    },
    [refresh]
  );

  async function addTransaction(value: New<Transaction>) {
    if (!supabase) {
      const item = { ...value, id: createId("tx") } as Transaction;
      setState((prev) => {
        const accounts = prev.accounts.map((account) => {
          if (value.type === "transfer") {
            if (account.id === value.source_account_id) return { ...account, current_balance: account.current_balance - value.amount };
            if (account.id === value.destination_account_id) return { ...account, current_balance: account.current_balance + value.amount };
          } else if (account.id === value.source_account_id) {
            return { ...account, current_balance: account.current_balance - value.amount };
          } else if (account.id === value.destination_account_id) {
            return { ...account, current_balance: account.current_balance + value.amount };
          }
          return account;
        });
        return { ...prev, accounts, transactions: [item, ...prev.transactions] };
      });
      toast.success(value.type === "transfer" ? "Trasferimento registrato" : "Movimento registrato");
      return;
    }
    const { error } = await supabase.rpc("record_transaction", { payload: value });
    if (error) throw error;
    await refresh();
    toast.success("Movimento registrato");
  }

  async function updateTransactionRecord(id: string, value: Partial<Transaction>) {
    if (!supabase) {
      setState((prev) => ({
        ...prev,
        transactions: prev.transactions.map((item) => (item.id === id ? { ...item, ...value } : item)),
      }));
      toast.success("Movimento aggiornato");
      return;
    }
    const { error } = await supabase.rpc("update_transaction", { transaction_id: id, payload: value });
    if (error) throw error;
    await refresh();
    toast.success("Movimento aggiornato");
  }

  async function removeTransactionRecord(id: string) {
    if (!supabase) {
      const tx = state.transactions.find((item) => item.id === id);
      if (!tx) return;
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.map((account) => {
          if (tx.type === "transfer") {
            if (account.id === tx.source_account_id) return { ...account, current_balance: account.current_balance + tx.amount };
            if (account.id === tx.destination_account_id) return { ...account, current_balance: account.current_balance - tx.amount };
          } else if (account.id === tx.source_account_id) {
            return { ...account, current_balance: account.current_balance + tx.amount };
          } else if (account.id === tx.destination_account_id) {
            return { ...account, current_balance: account.current_balance - tx.amount };
          }
          return account;
        }),
        transactions: prev.transactions.filter((item) => item.id !== id),
      }));
      toast.success("Movimento eliminato");
      return;
    }
    const { error } = await supabase.rpc("delete_transaction", { transaction_id: id });
    if (error) throw error;
    await refresh();
    toast.success("Movimento eliminato");
  }

  async function markBudgetPaid(id: string, accountId: string, paidDate: string) {
    const item = state.budget.find((row) => row.id === id);
    if (!item) return;
    if (!supabase) {
      await addTransaction({
        description: item.name,
        amount: item.amount,
        currency: item.currency,
        transaction_date: paidDate,
        type: item.direction === "expense" ? "expense" : "income",
        source_account_id: item.direction === "expense" ? accountId : null,
        destination_account_id: item.direction === "income" ? accountId : null,
        budget_item_id: id,
      });
      setState((prev) => ({
        ...prev,
        budget: prev.budget.map((row) =>
          row.id === id ? { ...row, status: "paid", paid_date: paidDate, account_id: accountId } : row
        ),
      }));
      return;
    }
    const { error } = await supabase.rpc("mark_budget_item_paid", {
      item_id: id,
      payment_account_id: accountId,
      payment_date: paidDate,
    });
    if (error) throw error;
    await refresh();
    toast.success("Voce pagata e movimento collegato");
  }

  async function duplicateBudget(targetMonth: string) {
    if (!supabase) {
      setState((prev) => ({
        ...prev,
        budget: prev.budget.map((item) => ({
          ...item,
          id: createId("b"),
          expected_date: item.expected_date
            ? `${targetMonth.slice(0, 8)}${item.expected_date.slice(8, 10)}`
            : targetMonth,
          status: "planned",
          paid_date: null,
        })),
      }));
    } else {
      const { error } = await supabase.rpc("duplicate_budget_month", {
        source_month: selectedMonth,
        target_month: targetMonth,
      });
      if (error) throw error;
    }
    setSelectedMonth(targetMonth);
    toast.success("Budget duplicato", { description: "Le voci esistenti non sono state duplicate." });
  }

  async function recordReceivablePayment(id: string, amount: number, accountId: string, date: string) {
    const receivable = state.receivables.find((row) => row.id === id);
    if (!receivable) return;
    if (!supabase) {
      await addTransaction({
        description: `Rimborso ${receivable.person} · ${receivable.description}`,
        amount,
        currency: receivable.currency,
        transaction_date: date,
        type: "refund_received",
        destination_account_id: accountId,
        person: receivable.person,
      });
      const received = receivable.received_amount + amount;
      setState((prev) => ({
        ...prev,
        receivables: prev.receivables.map((row) =>
          row.id === id
            ? {
                ...row,
                received_amount: received,
                received_installments: (row.received_installments ?? 0) + 1,
                status: received >= row.original_amount ? "settled" : "partial",
              }
            : row
        ),
      }));
      return;
    }
    const { error } = await supabase.rpc("record_receivable_payment", {
      receivable_id: id,
      payment_amount: amount,
      destination_account: accountId,
      payment_date: date,
    });
    if (error) throw error;
    await refresh();
    toast.success("Rimborso registrato");
  }

  async function seed() {
    if (!supabase) {
      setState(initialState);
      toast.success("Dati di esempio ripristinati");
      return;
    }
    const { error } = await supabase.rpc("seed_user_data");
    if (error) throw error;
    await refresh();
    toast.success("Dati iniziali caricati");
  }

  async function reconcileAccount(id: string, balance: number, note?: string) {
    if (!supabase) {
      setState((prev) => ({
        ...prev,
        accounts: prev.accounts.map((account) =>
          account.id === id ? { ...account, current_balance: balance, updated_at: new Date().toISOString() } : account
        ),
      }));
      toast.success("Saldo riconciliato", { description: note || "Rettifica registrata." });
      return;
    }
    const { error } = await supabase.rpc("reconcile_account", {
      account_id: id,
      new_balance: balance,
      adjustment_note: note || null,
    });
    if (error) throw error;
    await refresh();
    toast.success("Saldo riconciliato");
  }

  async function addBucket(value: New<Bucket> & { account_id?: string }) {
    if (!supabase) {
      const bucket: New<Bucket> = {
        name: value.name,
        kind: value.kind,
        color: value.color,
        currency: value.currency,
        allocated: value.allocated,
      };
      setState((prev) => ({
        ...prev,
        buckets: [...prev.buckets, { ...bucket, id: createId("bucket") }],
      }));
      toast.success("Bucket creato");
      return;
    }
    const { error } = await supabase.rpc("create_savings_bucket", {
      bucket_name: value.name,
      bucket_kind: value.kind,
      bucket_color: value.color,
      bucket_currency: value.currency,
      allocation_account_id: value.account_id || null,
      allocation_amount: value.allocated,
    });
    if (error) throw error;
    await refresh();
    toast.success("Bucket creato");
  }

  const value: FinanceContextValue = {
      ...state,
      loading,
      authLoading,
      demoMode: !hasSupabaseEnv,
      user,
      selectedMonth,
      setSelectedMonth,
      refresh,
      seed,
      addAccount: (value) => insert<Account>("accounts", "accounts", value, "account"),
      updateAccount: (id, value) => update<Account>("accounts", "accounts", id, value),
      reconcileAccount,
      removeAccount: (id) => remove<Account>("accounts", "accounts", id),
      addTransaction,
      updateTransaction: updateTransactionRecord,
      removeTransaction: removeTransactionRecord,
      addBudgetItem: (value) => insert<BudgetItem>("budget_items", "budget", value, "budget"),
      updateBudgetItem: (id, value) => update<BudgetItem>("budget_items", "budget", id, value),
      removeBudgetItem: (id) => remove<BudgetItem>("budget_items", "budget", id),
      markBudgetPaid,
      duplicateBudget,
      addRecurring: (value) => insert<RecurringItem>("recurring_items", "recurring", value, "recurring"),
      updateRecurring: (id, value) => update<RecurringItem>("recurring_items", "recurring", id, value),
      removeRecurring: (id) => remove<RecurringItem>("recurring_items", "recurring", id),
      addTaxFund: (value) => insert<TaxFund>("tax_funds", "taxFunds", value, "tax"),
      updateTaxFund: (id, value) => update<TaxFund>("tax_funds", "taxFunds", id, value),
      removeTaxFund: (id) => remove<TaxFund>("tax_funds", "taxFunds", id),
      addReceivable: (value) => insert<Receivable>("receivables", "receivables", value, "receivable"),
      updateReceivable: (id, value) => update<Receivable>("receivables", "receivables", id, value),
      removeReceivable: (id) => remove<Receivable>("receivables", "receivables", id),
      recordReceivablePayment,
      addBucket,
    };

  return <FinanceContext.Provider value={value}>{children}</FinanceContext.Provider>;
}

export function useFinance() {
  const value = useContext(FinanceContext);
  if (!value) throw new Error("useFinance must be used inside FinanceProvider");
  return value;
}
