"use client";

import { FormEvent, useEffect, useState } from "react";
import { ChevronDown, Copy, Repeat2, Trash2, WalletCards, X } from "lucide-react";
import { useFlow } from "./app-provider";
import { useConfirm } from "./confirm-provider";
import type { ExpenseKind, Frequency, TransactionType } from "@/lib/types";

const today = () => new Date().toISOString().slice(0, 10);

export function TransactionSheet() {
  const { data, transactionSheetOpen, editingTransaction, transactionPreset, closeTransactionSheet, addTransaction, updateTransaction, deleteTransaction, duplicateTransaction } = useFlow();
  const confirm = useConfirm();
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<TransactionType>("expense");
  const [date, setDate] = useState(today());
  const [fundId, setFundId] = useState("available");
  const [fundAccountId, setFundAccountId] = useState("");
  const [destinationFundId, setDestinationFundId] = useState("savings");
  const [destinationFundAccountId, setDestinationFundAccountId] = useState("");
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>("variable");
  const [paymentMethod, setPaymentMethod] = useState<"bank" | "amex">("bank");
  const [recurring, setRecurring] = useState(false);
  const [spendingBudget, setSpendingBudget] = useState(false);
  const [recurringBudgetId, setRecurringBudgetId] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("monthly");
  const [paymentDay, setPaymentDay] = useState(String(new Date().getDate()));
  const [interval, setInterval] = useState("1");
  const [paymentCount, setPaymentCount] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (editingTransaction) {
      // Reset the progressive form when a different timeline item is opened.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setAmount(String(editingTransaction.amount));
      setName(editingTransaction.name);
      setType(editingTransaction.type);
      setDate(editingTransaction.date);
      setFundId(editingTransaction.fundId);
      setFundAccountId(editingTransaction.fundAccountId ?? data.funds.find((fund) => fund.id === editingTransaction.fundId)?.accounts?.[0]?.id ?? "");
      setDestinationFundId(editingTransaction.destinationFundId ?? data.funds.find((fund) => fund.id !== editingTransaction.fundId)?.id ?? "savings");
      setDestinationFundAccountId(editingTransaction.destinationFundAccountId ?? data.funds.find((fund) => fund.id === editingTransaction.destinationFundId)?.accounts?.[0]?.id ?? "");
      setExpenseKind(editingTransaction.expenseKind ?? "fixed");
      setPaymentMethod(editingTransaction.paymentMethod ?? "bank");
      setRecurring(Boolean(editingTransaction.recurrence));
      setSpendingBudget(Boolean(editingTransaction.recurrence?.spendingBudget));
      setRecurringBudgetId(editingTransaction.recurringBudgetId ?? "");
      setFrequency(editingTransaction.recurrence?.frequency ?? "monthly");
      setPaymentDay(String(editingTransaction.recurrence?.paymentDay ?? new Date(editingTransaction.date).getDate()));
      setInterval(String(editingTransaction.recurrence?.interval ?? 1));
      setPaymentCount(editingTransaction.recurrence?.paymentCount ? String(editingTransaction.recurrence.paymentCount) : "");
      setEndDate(editingTransaction.recurrence?.endDate ?? "");
      setCategory(editingTransaction.category ?? "");
      setNotes(editingTransaction.notes ?? "");
      setShowAdvanced(Boolean(editingTransaction.category || editingTransaction.notes));
    } else {
      const fixedFund = data.funds.find((fund) => fund.kind === "income") ?? data.funds.find((fund) => fund.kind === "savings") ?? data.funds[0];
      const sourceFund = transactionPreset === "fixed" ? fixedFund : data.funds.find((fund) => fund.kind === "available") ?? data.funds[0];
      const destinationFund = data.funds.find((fund) => fund.id !== sourceFund?.id);
      setAmount(""); setName(""); setType("expense"); setDate(today()); setFundId(sourceFund?.id ?? ""); setFundAccountId(sourceFund?.accounts?.[0]?.id ?? ""); setDestinationFundId(destinationFund?.id ?? ""); setDestinationFundAccountId(destinationFund?.accounts?.[0]?.id ?? ""); setExpenseKind(transactionPreset === "fixed" ? "fixed" : "variable"); setPaymentMethod(transactionPreset === "amex" ? "amex" : "bank");
      setRecurring(transactionPreset === "fixed"); setSpendingBudget(false); setRecurringBudgetId(""); setFrequency("monthly"); setPaymentDay(String(new Date().getDate())); setInterval("1"); setPaymentCount(""); setEndDate("");
      setCategory(""); setNotes(""); setShowAdvanced(false);
    }
  }, [data.funds, editingTransaction, transactionPreset, transactionSheetOpen]);

  const recurringBudgets = data.transactions.filter((transaction) => transaction.type === "expense" && transaction.recurrence?.spendingBudget && transaction.id !== editingTransaction?.id);
  const evChargingBudget = recurringBudgets.find((budget) => budget.id === "charging")
    ?? recurringBudgets.find((budget) => /ev charging|ricaric/i.test(budget.name));

  function submit(event: FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!name.trim() || !numericAmount || (type === "transfer" && fundId === destinationFundId)) return;
    const transaction = {
      id: editingTransaction?.id ?? crypto.randomUUID(),
      name: name.trim(),
      amount: Math.abs(numericAmount),
      type,
      date,
      fundId,
      fundAccountId: data.funds.find((fund) => fund.id === fundId)?.accounts?.length ? fundAccountId || undefined : undefined,
      destinationFundId: type === "transfer" ? destinationFundId : undefined,
      destinationFundAccountId: type === "transfer" && data.funds.find((fund) => fund.id === destinationFundId)?.accounts?.length ? destinationFundAccountId || undefined : undefined,
      category: category || undefined,
      notes: notes || undefined,
      expenseKind: type === "expense" ? expenseKind : undefined,
      paymentMethod: type === "expense" ? paymentMethod : undefined,
      amexReserved: type === "expense" && paymentMethod === "amex" ? editingTransaction?.amexReserved ?? false : undefined,
      recurringBudgetId: type === "expense" && !recurring ? recurringBudgetId || undefined : undefined,
      createdAt: editingTransaction?.createdAt ?? new Date().toISOString(),
      recurrence: recurring ? {
        frequency,
        interval: frequency === "custom" || frequency === "weekly" ? Math.max(1, Number(interval)) : undefined,
        paymentDay: Number(paymentDay),
        startDate: date,
        endDate: endDate || undefined,
        paymentCount: paymentCount ? Math.max(1, Number(paymentCount)) : undefined,
        amexReservedDates: paymentMethod === "amex" ? editingTransaction?.recurrence?.amexReservedDates : undefined,
        spendingBudget: type === "expense" ? spendingBudget || undefined : undefined,
      } : undefined,
    };
    if (editingTransaction) updateTransaction(transaction); else addTransaction(transaction);
    closeTransactionSheet();
  }

  async function remove() {
    if (!editingTransaction) return;
    const approved = await confirm({ title: "Delete transaction?", message: `“${editingTransaction.name}” will be removed and its effect on the fund will be reversed.`, confirmLabel: "Delete", danger: true });
    if (!approved) return;
    deleteTransaction(editingTransaction.id);
    closeTransactionSheet();
  }

  return (
    <div className={`sheet-layer ${transactionSheetOpen ? "open" : ""}`} aria-hidden={!transactionSheetOpen}>
      <button className="sheet-backdrop" aria-label="Close transaction form" onClick={closeTransactionSheet} />
      <section className="transaction-sheet" role="dialog" aria-modal="true" aria-label={editingTransaction ? "Edit transaction" : "New transaction"}>
        <div className="sheet-handle" />
        <header className="sheet-header">
          <button className="icon-button" type="button" onClick={closeTransactionSheet} aria-label="Close"><X size={20} /></button>
          <strong>{editingTransaction ? "Edit transaction" : "New transaction"}</strong>
          {editingTransaction ? <button className="icon-button danger" type="button" onClick={remove} aria-label="Delete transaction"><Trash2 size={19} /></button> : <span className="icon-spacer" />}
        </header>
        <form onSubmit={submit} className="transaction-form">
          <div className="type-segment" aria-label="Transaction type">
            {(["expense", "income", "transfer"] as TransactionType[]).map((item) => (
              <button key={item} type="button" className={type === item ? "active" : ""} onClick={() => setType(item)}>{item}</button>
            ))}
          </div>
          <label className="amount-field">
            <span>Amount</span>
            <div><small>€</small><input autoFocus inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value.replace(/^0+(?=\d)/, ""))} placeholder="0" aria-label="Amount" /></div>
          </label>
          <div className="form-card">
            <label className="form-row">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="What is it?" required />
            </label>
            <label className="form-row">
              <span>Date</span>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            {type !== "expense" || paymentMethod !== "amex" ? <><label className="form-row">
              <span>Fund</span>
              <select value={fundId} onChange={(e) => { const next = e.target.value; const nextFund = data.funds.find((fund) => fund.id === next); setFundId(next); setFundAccountId(nextFund?.accounts?.[0]?.id ?? ""); if (destinationFundId === next) { const destination = data.funds.find((fund) => fund.id !== next); setDestinationFundId(destination?.id ?? ""); setDestinationFundAccountId(destination?.accounts?.[0]?.id ?? ""); } }}>
                {data.funds.map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}
              </select>
            </label>
            {data.funds.find((fund) => fund.id === fundId)?.accounts?.length ? <label className="form-row reveal"><span>{type === "transfer" ? "From account" : "Account"}</span><select value={fundAccountId} onChange={(e) => setFundAccountId(e.target.value)}>{data.funds.find((fund) => fund.id === fundId)?.accounts?.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label> : null}</> : null}
            {type === "transfer" ? <><label className="form-row reveal"><span>To fund</span><select value={destinationFundId} onChange={(e) => { const next = e.target.value; setDestinationFundId(next); setDestinationFundAccountId(data.funds.find((fund) => fund.id === next)?.accounts?.[0]?.id ?? ""); }}>{data.funds.filter((fund) => fund.id !== fundId).map((fund) => <option value={fund.id} key={fund.id}>{fund.name}</option>)}</select></label>{data.funds.find((fund) => fund.id === destinationFundId)?.accounts?.length ? <label className="form-row reveal"><span>To account</span><select value={destinationFundAccountId} onChange={(e) => setDestinationFundAccountId(e.target.value)}>{data.funds.find((fund) => fund.id === destinationFundId)?.accounts?.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label> : null}</> : null}
            {type === "expense" ? <label className="form-row"><span>Paid with</span><select aria-label="Payment method" value={paymentMethod} onChange={(e) => { const method = e.target.value as "bank" | "amex"; setPaymentMethod(method); if (method === "amex") { const availableFund = data.funds.find((fund) => fund.kind === "available"); setFundId(availableFund?.id ?? fundId); setFundAccountId(availableFund?.accounts?.[0]?.id ?? ""); } }}><option value="bank">Bank account</option><option value="amex">American Express</option></select></label> : null}
            {type === "expense" && !recurring && recurringBudgets.length ? <label className="form-row budget-link-row"><span>Take from budget</span><select aria-label="Recurring budget" value={recurringBudgetId} onChange={(e) => {
              const nextBudgetId = e.target.value;
              setRecurringBudgetId(nextBudgetId);
              if (nextBudgetId === evChargingBudget?.id) setName("Ricarica");
              else if (recurringBudgetId === evChargingBudget?.id && name === "Ricarica") setName("");
            }}><option value="">No recurring budget</option>{recurringBudgets.map((budget) => <option value={budget.id} key={budget.id}>{budget.name} · €{budget.amount.toFixed(2)}</option>)}</select></label> : null}
            <label className="form-row switch-row">
              <span><Repeat2 size={17} /> Recurring</span>
              <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} />
            </label>
          </div>
          {recurring ? (
            <div className="form-card reveal">
              <label className="form-row"><span>Frequency</span><select value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="yearly">Yearly</option><option value="custom">Custom</option></select></label>
              {frequency !== "weekly" ? <label className="form-row"><span>Payment day</span><input type="number" inputMode="numeric" min="1" max="31" value={paymentDay} onChange={(e) => setPaymentDay(e.target.value)} /></label> : null}
              {frequency === "custom" || frequency === "weekly" ? <label className="form-row"><span>Every</span><div className="inline-unit"><input type="number" inputMode="numeric" min="1" value={interval} onChange={(e) => setInterval(e.target.value)} /><span>{frequency === "weekly" ? "week(s)" : "month(s)"}</span></div></label> : null}
              <label className="form-row"><span>Ends</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} /></label>
              <label className="form-row"><span>Number of payments</span><input type="number" inputMode="numeric" min="1" value={paymentCount} onChange={(e) => setPaymentCount(e.target.value)} placeholder="No limit" /></label>
              {type === "expense" ? <><label className="form-row switch-row"><span><WalletCards size={17} /> Spending budget</span><input aria-label="Spending budget" type="checkbox" checked={spendingBudget} onChange={(e) => setSpendingBudget(e.target.checked)} /></label>{spendingBudget ? <p className="form-row-help">Actual expenses can draw down this amount during each pay cycle.</p> : null}</> : null}
            </div>
          ) : null}
          <button type="button" className="advanced-toggle" onClick={() => setShowAdvanced((value) => !value)}>Advanced options <ChevronDown size={16} className={showAdvanced ? "rotate" : ""} /></button>
          {showAdvanced ? <div className="form-card reveal">{type === "expense" ? <label className="form-row"><span>Expense type</span><select value={expenseKind} onChange={(e) => setExpenseKind(e.target.value as ExpenseKind)}><option value="fixed">Fixed</option><option value="variable">Variable / lifestyle</option></select></label> : null}<label className="form-row"><span>Category</span><input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Optional" /></label><label className="form-row"><span>Notes</span><input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional" /></label></div> : null}
          <button className="primary-button full" type="submit">{editingTransaction ? "Save changes" : "Add transaction"}</button>
          {editingTransaction ? <button className="duplicate-sheet-button" type="button" onClick={() => { duplicateTransaction(editingTransaction); closeTransactionSheet(); }}><Copy size={15} /> Duplicate transaction</button> : null}
          {editingTransaction ? <button className="delete-sheet-button" type="button" onClick={remove}><Trash2 size={15} /> Delete transaction</button> : null}
        </form>
      </section>
    </div>
  );
}
