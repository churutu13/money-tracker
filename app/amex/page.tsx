"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, CreditCard, Pencil, Plus, WalletCards } from "lucide-react";
import { AnimatedMoney, AnimatedPercent } from "@/components/animated-money";
import { PageHeader } from "@/components/page-header";
import { useFlow } from "@/components/app-provider";
import { getAmexCycle, getAmexPurchases, getAmexSummary } from "@/lib/engine";
import { formatDate, formatMoney } from "@/lib/format";
import type { AmexPurchase } from "@/lib/engine";

export default function AmexPage() {
  const { data, hydrated, openTransactionSheet, updateTransaction } = useFlow();
  const reducedMotion = useReducedMotion();
  const [newPurchase, setNewPurchase] = useState<AmexPurchase | null>(null);
  const [purchasePhase, setPurchasePhase] = useState<"cash" | "pot" | null>(null);
  const seenPurchases = useRef<Set<string> | null>(null);
  const phaseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summary = getAmexSummary(data);
  const available = data.funds.find((fund) => fund.kind === "available")?.balance ?? 0;
  const effectiveAvailable = available - summary.unreservedOutstanding;
  const purchases = getAmexPurchases(data).sort((a, b) => b.date.localeCompare(a.date));
  const grouped = Object.entries(Object.groupBy(purchases, (transaction) => getAmexCycle(new Date(`${transaction.date}T12:00:00`)).key)).sort(([a], [b]) => b.localeCompare(a));
  const coverage = summary.total > 0 ? Math.min(1, summary.reserved / summary.total) : 0;

  useEffect(() => {
    if (!hydrated) return;
    const currentPurchases = getAmexPurchases(data);
    const currentIds = new Set(currentPurchases.map((transaction) => transaction.id));
    if (!seenPurchases.current) {
      seenPurchases.current = currentIds;
      return;
    }
    const added = currentPurchases.find((transaction) => !seenPurchases.current?.has(transaction.id));
    seenPurchases.current = currentIds;
    if (!added) return;

    setNewPurchase(added);
    setPurchasePhase("cash");
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    phaseTimer.current = setTimeout(() => setPurchasePhase("pot"), reducedMotion ? 0 : 360);
    noticeTimer.current = setTimeout(() => {
      setNewPurchase(null);
      setPurchasePhase(null);
    }, reducedMotion ? 1600 : 2200);
  }, [data, hydrated, reducedMotion]);

  useEffect(() => () => {
    if (phaseTimer.current) clearTimeout(phaseTimer.current);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  function toggleReserved(purchase: AmexPurchase) {
    if (!purchase.recurring || !purchase.transaction.recurrence) {
      updateTransaction({ ...purchase.transaction, amexReserved: !purchase.reserved });
      return;
    }
    const reservedDates = new Set(purchase.transaction.recurrence.amexReservedDates ?? []);
    if (purchase.reserved) reservedDates.delete(purchase.date);
    else reservedDates.add(purchase.date);
    updateTransaction({
      ...purchase.transaction,
      recurrence: { ...purchase.transaction.recurrence, amexReservedDates: [...reservedDates].sort() },
    });
  }

  return <div className="content-wrap narrow amex-page">
    <PageHeader title="American Express" subtitle="Track each statement and set its money aside." action={<button className="primary-button desktop-add" onClick={() => openTransactionSheet(undefined, "amex")}><Plus size={17} /> Add Amex expense</button>} />

    <AnimatePresence>
      {newPurchase ? <motion.div className="amex-purchase-notice card" initial={reducedMotion ? false : { opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: reducedMotion ? 0 : 0.24 }}>
        <span className="amex-purchase-notice-icon"><CreditCard size={16} /></span>
        <span><small>New Amex purchase</small><strong>−{formatMoney(newPurchase.amount)}</strong></span>
        <span className="amex-purchase-flow">{newPurchase.transaction.recurringBudgetId
          ? <><motion.small animate={{ opacity: purchasePhase === "cash" ? 1 : 0.45 }}>Recurring budget ↓</motion.small><motion.small animate={{ opacity: purchasePhase === "pot" ? 1 : 0.45 }}>Available cash unchanged</motion.small></>
          : <><motion.small animate={{ opacity: purchasePhase === "cash" ? 1 : 0.45 }}>Available cash ↓</motion.small><motion.small animate={{ opacity: purchasePhase === "pot" ? 1 : 0.45 }}>To-reserve pot ↑</motion.small></>}</span>
      </motion.div> : null}
    </AnimatePresence>

    <section className="amex-overview">
      <article className="amex-balance-card amex-statement-card card"><div className="amex-statement-copy"><span><CreditCard size={17} /> Current statement</span><AnimatedMoney value={summary.total} /><small>{summary.cycle.label} · due {formatDate(summary.cycle.dueDate.toISOString().slice(0, 10), { day: "numeric", month: "short" })}</small></div><CoverageRing coverage={coverage} reducedMotion={Boolean(reducedMotion)} /></article>
      <article className="card"><span>Already covered</span><AnimatedMoney className="positive-text" value={summary.reserved} /><small>Set aside or covered by a recurring budget</small></article>
      <motion.article className="card" animate={{ boxShadow: purchasePhase === "pot" ? "0 0 0 1px rgba(139, 120, 223, .28), 0 15px 38px rgba(139, 120, 223, .14)" : "0 1px 0 rgba(255,255,255,.4), 0 12px 34px rgba(30,32,34,.035)" }} transition={{ duration: reducedMotion ? 0 : 0.4 }}><span>Still to set aside</span><AnimatedMoney className={summary.toReserve > 0 ? "warning-text" : "positive-text"} value={summary.toReserve} duration={0.48} delay={reducedMotion ? 0 : 0.32} /><small>{summary.toReserve > 0 ? "Still included in Available Cash" : "Statement fully covered"}</small></motion.article>
    </section>

    <motion.section className="amex-available card" animate={{ boxShadow: purchasePhase === "cash" ? "0 0 0 1px rgba(139, 120, 223, .24), 0 14px 36px rgba(139, 120, 223, .12)" : "0 1px 0 rgba(255,255,255,.4), 0 12px 34px rgba(30,32,34,.035)" }} transition={{ duration: reducedMotion ? 0 : 0.4 }}>
      <span className="amex-available-icon"><WalletCards size={18} /></span>
      <div><span>Available after every unreserved Amex purchase</span><AnimatedMoney value={effectiveAvailable} /></div>
      <small>{formatMoney(summary.unreservedOutstanding)} still needs to be moved</small>
    </motion.section>

    <div className="amex-cycle-list">
      {grouped.map(([key, items]) => {
        if (!items?.length) return null;
        const cycle = getAmexCycle(new Date(`${items[0].date}T12:00:00`));
        const total = items.reduce((sum, transaction) => sum + transaction.amount, 0);
        const reserved = items.reduce((sum, transaction) => sum + (transaction.reserved ? transaction.amount : 0), 0);
        return <section key={key}>
          <div className="timeline-heading"><div><h2>{cycle.longLabel}</h2><small>Debit on {cycle.dueDate.toLocaleDateString("en-IE", { day: "numeric", month: "short", year: "numeric" })}</small></div><span>{formatMoney(reserved, true)} / {formatMoney(total, true)}</span></div>
          <div className="amex-list card">
            {items.map((transaction) => <div className={`amex-row ${transaction.reserved ? "reserved" : "pending"}`} key={transaction.id}>
              <button className="amex-check" onClick={() => toggleReserved(transaction)} aria-label={`${transaction.reserved ? "Mark as not set aside" : "Mark as set aside"}: ${transaction.transaction.name}`}><Check size={16} /></button>
              <button className="amex-main" onClick={() => openTransactionSheet(transaction.transaction)}><strong>{transaction.transaction.name}{transaction.recurring ? <small className="recurring-badge">Recurring</small> : null}</strong><small>{transaction.transaction.category ?? "Amex purchase"} · {formatDate(transaction.date)}</small></button>
              <strong>{formatMoney(transaction.amount)}</strong>
              <button className="amex-edit" onClick={() => openTransactionSheet(transaction.transaction)} aria-label={`Edit ${transaction.transaction.name}`}><Pencil size={15} /></button>
            </div>)}
          </div>
        </section>;
      })}
      {!purchases.length ? <div className="empty-state card"><CreditCard size={25} /><h2>No Amex purchases yet</h2><p>Add an expense and choose American Express as the payment method.</p><button className="primary-button" onClick={() => openTransactionSheet(undefined, "amex")}><Plus size={16} /> Add first expense</button></div> : null}
    </div>
  </div>;
}

function CoverageRing({ coverage, reducedMotion }: { coverage: number; reducedMotion: boolean }) {
  return <div className="amex-coverage-ring" aria-label={`${Math.round(coverage * 100)}% of the current statement is covered`}>
    <svg viewBox="0 0 44 44" aria-hidden="true">
      <circle className="amex-ring-track" cx="22" cy="22" r="18" fill="none" strokeWidth="4" />
      <motion.circle className="amex-ring-value" cx="22" cy="22" r="18" fill="none" strokeWidth="4" strokeLinecap="round" initial={reducedMotion ? false : { pathLength: 0 }} animate={{ pathLength: coverage }} transition={{ duration: reducedMotion ? 0 : 0.58, ease: [0.22, 1, 0.36, 1] }} />
    </svg>
    <AnimatedPercent value={coverage * 100} />
  </div>;
}
