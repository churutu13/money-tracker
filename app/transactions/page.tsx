"use client";

import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { AnimatePresence, motion, useMotionValue, useReducedMotion, type PanInfo } from "motion/react";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, BatteryCharging, CircleHelp, Copy, CreditCard, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { AnimatedMoney } from "@/components/animated-money";
import { useFlow } from "@/components/app-provider";
import { useConfirm } from "@/components/confirm-provider";
import { PageHeader } from "@/components/page-header";
import { getCycleStartDay, getFinancialCycle, getRecurringBudgetProgress, getRecurringCycleSummary, getRecurringStatus, recurrenceDatesInRange } from "@/lib/engine";
import { formatDate, formatMoney } from "@/lib/format";
import type { Transaction, TransactionType } from "@/lib/types";

type TransactionFilter = "variable" | "recurring" | "ev_charging" | Exclude<TransactionType, "expense"> | "amex" | "all";

const FILTERS: Array<{ value: TransactionFilter; label: string }> = [
  { value: "variable", label: "Variable" },
  { value: "recurring", label: "Recurring" },
  { value: "ev_charging", label: "EV charging" },
  { value: "income", label: "Income" },
  { value: "transfer", label: "Transfers" },
  { value: "amex", label: "Amex" },
  { value: "all", label: "All" },
];

export default function TransactionsPage() {
  const { data, openTransactionSheet, deleteTransaction, duplicateTransaction } = useFlow();
  const confirm = useConfirm();
  const reducedMotion = useReducedMotion();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<TransactionFilter>("variable");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [actionTransaction, setActionTransaction] = useState<Transaction | null>(null);
  const chipBarRef = useRef<HTMLDivElement>(null);
  const swipeAreaRef = useRef<HTMLDivElement>(null);
  const swipeX = useMotionValue(0);
  const swiped = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStart = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);
  const longPressTransaction = useRef<Transaction | null>(null);
  const evChargingBudget = useMemo(() => data.transactions.find((transaction) => transaction.id === "charging" && transaction.recurrence?.spendingBudget)
    ?? data.transactions.find((transaction) => transaction.recurrence?.spendingBudget && /ev charging|ricaric/i.test(transaction.name)), [data.transactions]);
  const evChargingProgress = useMemo(() => evChargingBudget ? getRecurringBudgetProgress(data, evChargingBudget) : null, [data, evChargingBudget]);
  const filtered = useMemo(() => data.transactions.filter((item) => {
    const matchesSearch = `${item.name} ${item.category ?? ""}`.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "variable") return item.type === "expense" && !item.recurrence;
    if (filter === "recurring") return item.type === "expense" && Boolean(item.recurrence);
    if (filter === "ev_charging") return item.type === "expense" && !item.recurrence && item.recurringBudgetId === evChargingBudget?.id;
    if (filter === "amex") return item.type === "expense" && item.paymentMethod === "amex";
    return filter === "all" || item.type === filter;
  }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)), [data.transactions, evChargingBudget?.id, filter, search]);
  const cycleStartDay = getCycleStartDay(data);
  const currentCycle = getFinancialCycle(new Date(), cycleStartDay);
  const groups = Object.groupBy(filtered, (item) => item.recurrence && recurrenceDatesInRange(item.recurrence, currentCycle.start, currentCycle.end).length
    ? currentCycle.longLabel
    : getFinancialCycle(new Date(`${item.date}T12:00:00`), cycleStartDay).longLabel);
  const recurringSummary = useMemo(() => getRecurringCycleSummary(data), [data]);

  useEffect(() => () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  }, []);

  useEffect(() => {
    const area = swipeAreaRef.current;
    if (!area) return;

    const clearTouchPress = () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
      longPressStart.current = null;
      longPressTransaction.current = null;
      longPressTriggered.current = false;
    };
    const startTouchPress = (event: TouchEvent) => {
      const touch = event.touches[0];
      const row = (event.target as Element | null)?.closest<HTMLElement>(".transaction-item[data-transaction-id]");
      const transaction = data.transactions.find((item) => item.id === row?.dataset.transactionId);
      if (!touch || transaction?.type !== "expense") return;
      clearTouchPress();
      longPressStart.current = { x: touch.clientX, y: touch.clientY };
      longPressTransaction.current = transaction;
      longPressTimer.current = setTimeout(() => {
        window.getSelection()?.removeAllRanges();
        longPressTriggered.current = true;
        longPressTimer.current = null;
      }, 380);
    };
    const moveTouchPress = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch || !longPressStart.current) return;
      if (Math.hypot(touch.clientX - longPressStart.current.x, touch.clientY - longPressStart.current.y) > 10) clearTouchPress();
    };
    const endTouchPress = () => {
      const transaction = longPressTriggered.current ? longPressTransaction.current : null;
      clearTouchPress();
      if (transaction) {
        longPressTriggered.current = true;
        window.getSelection()?.removeAllRanges();
        setActionTransaction(transaction);
      }
    };

    area.addEventListener("touchstart", startTouchPress, { passive: true });
    area.addEventListener("touchmove", moveTouchPress, { passive: true });
    area.addEventListener("touchend", endTouchPress, { passive: true });
    area.addEventListener("touchcancel", clearTouchPress, { passive: true });
    return () => {
      area.removeEventListener("touchstart", startTouchPress);
      area.removeEventListener("touchmove", moveTouchPress);
      area.removeEventListener("touchend", endTouchPress);
      area.removeEventListener("touchcancel", clearTouchPress);
      clearTouchPress();
    };
  }, [data.transactions]);

  useEffect(() => {
    const active = chipBarRef.current?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]');
    active?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "nearest", inline: "center" });
  }, [filter, reducedMotion]);

  function moveFilter(direction: -1 | 1) {
    const currentIndex = FILTERS.findIndex((item) => item.value === filter);
    const nextIndex = (currentIndex + direction + FILTERS.length) % FILTERS.length;
    setFilter(FILTERS[nextIndex].value);
    setExpandedId(null);
  }

  function finishSwipe(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    const shouldMove = Math.abs(info.offset.x) > 42 || Math.abs(info.velocity.x) > 420;
    swipeX.stop();
    swipeX.set(0);
    if (!shouldMove) {
      window.setTimeout(() => { swiped.current = false; }, 80);
      return;
    }
    swiped.current = true;
    moveFilter(info.offset.x < 0 ? 1 : -1);
    window.setTimeout(() => { swiped.current = false; }, 320);
  }

  function beginLongPress(event: ReactPointerEvent<HTMLDivElement>, transaction: Transaction) {
    if (event.pointerType === "touch" || transaction.type !== "expense" || (event.pointerType === "mouse" && event.button !== 0)) return;
    armLongPress(event.clientX, event.clientY, transaction);
  }

  function armLongPress(clientX: number, clientY: number, transaction: Transaction) {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressStart.current = { x: clientX, y: clientY };
    longPressTransaction.current = transaction;
    longPressTriggered.current = false;
    longPressTimer.current = setTimeout(() => {
      window.getSelection()?.removeAllRanges();
      longPressTriggered.current = true;
      longPressTimer.current = null;
    }, 380);
  }

  function moveLongPress(event: ReactPointerEvent<HTMLDivElement>) {
    if (!longPressStart.current || !longPressTimer.current) return;
    if (Math.hypot(event.clientX - longPressStart.current.x, event.clientY - longPressStart.current.y) > 10) cancelLongPress();
  }

  function cancelLongPress() {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    longPressStart.current = null;
    longPressTransaction.current = null;
    longPressTriggered.current = false;
  }

  function finishLongPress() {
    const transaction = longPressTriggered.current ? longPressTransaction.current : null;
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
    longPressTimer.current = null;
    longPressStart.current = null;
    longPressTransaction.current = null;
    if (transaction) {
      window.getSelection()?.removeAllRanges();
      setActionTransaction(transaction);
    }
  }

  function colour(transaction: Transaction) {
    if (transaction.recurrence) return `recurring-${getRecurringStatus(transaction, data) ?? "upcoming"}`;
    return transaction.type;
  }

  async function removeTransaction(transaction: Transaction) {
    const approved = await confirm({ title: "Delete transaction?", message: `“${transaction.name}” will be removed and its effect on the fund will be reversed.`, confirmLabel: "Delete", danger: true });
    if (approved) deleteTransaction(transaction.id);
  }

  return <div className="content-wrap narrow">
    <PageHeader title="Transactions" subtitle="See where your money is going." action={<button className="primary-button desktop-add" onClick={() => openTransactionSheet()}><Plus size={17} /> Add</button>} />

    <div className="transaction-controls">
      <label className="compact-search card"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions" aria-label="Search transactions" /></label>
      <div className="transaction-chip-bar">
        <div className="transaction-chips" role="group" aria-label="Transaction filters" ref={chipBarRef}>
          {FILTERS.map((item) => <button key={item.value} onClick={() => setFilter(item.value)} className={filter === item.value ? "active" : ""} aria-pressed={filter === item.value}>
            {filter === item.value ? <motion.span className="transaction-chip-active" layoutId="transaction-filter-active" transition={reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 520, damping: 42, mass: 0.65 }} /> : null}
            <span>{item.label}</span>
          </button>)}
        </div>
        <button className="legend-button" onClick={() => setLegendOpen(true)} aria-label="Open colour guide"><CircleHelp size={15} /><span>Colours</span></button>
      </div>
    </div>

    <motion.div ref={swipeAreaRef} className="transactions-swipe-area" style={{ x: reducedMotion ? 0 : swipeX }} drag={reducedMotion ? false : "x"} dragConstraints={{ left: 0, right: 0 }} dragElastic={0.22} dragMomentum={false} onDragEnd={finishSwipe} onPointerUpCapture={(event) => { if (event.pointerType !== "touch") finishLongPress(); }} onClickCapture={(event) => { if (swiped.current) { event.preventDefault(); event.stopPropagation(); } }}>
      <AnimatePresence initial={false} mode="popLayout">
        {filter === "recurring" ? <motion.section key="recurring-summary" className="recurring-cycle-summary card" initial={reducedMotion ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 8 }} transition={{ duration: reducedMotion ? 0 : 0.24 }}>
          <span><small>Planned this cycle</small><strong>{formatMoney(recurringSummary.planned)}</strong></span>
          <span><small>Still allocated</small><strong>{formatMoney(recurringSummary.remaining)}</strong></span>
          <span><small>Used from budgets</small><strong>{formatMoney(recurringSummary.budgetSpent)}</strong></span>
        </motion.section> : null}
        {filter === "ev_charging" && evChargingProgress ? <motion.article key="ev-charging-summary" className="balance-card ev-charging-summary card" initial={reducedMotion ? false : { opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -8 }} transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}>
          <div className="balance-topline"><span>EV charging available</span><BatteryCharging size={20} /></div>
          <AnimatedMoney value={evChargingProgress.remaining} duration={0.55} />
          <p>Left from this pay cycle&apos;s charging budget</p>
          <div className="ev-charging-progress" aria-label={`${Math.round(evChargingProgress.planned ? evChargingProgress.spent / evChargingProgress.planned * 100 : 0)}% of charging budget used`}><motion.span initial={reducedMotion ? false : { width: 0 }} animate={{ width: `${Math.min(100, evChargingProgress.planned ? evChargingProgress.spent / evChargingProgress.planned * 100 : 0)}%` }} transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }} /></div>
          <div className="balance-divider" />
          <div className="available-split"><div><span>Planned</span><strong>{formatMoney(evChargingProgress.planned)}</strong></div><div><span>Used</span><strong>{formatMoney(evChargingProgress.spent)}</strong></div>{evChargingProgress.over > 0 ? <div><span>Over budget</span><strong className="negative-text">{formatMoney(evChargingProgress.over)}</strong></div> : null}</div>
        </motion.article> : null}
      </AnimatePresence>

      <motion.div className="timeline" layout>{Object.entries(groups).map(([cycle, items]) => <motion.section layout key={cycle}><div className="timeline-heading"><h2>{cycle}</h2><span>{items?.length ?? 0} items</span></div><motion.div className="timeline-card card" layout>{items?.map((transaction) => {
      const status = colour(transaction);
      const expanded = expandedId === transaction.id;
      const fundName = data.funds.find((fund) => fund.id === transaction.fundId)?.name ?? "No fund";
      const budgetProgress = transaction.recurrence?.spendingBudget ? getRecurringBudgetProgress(data, transaction) : null;
      const linkedBudget = transaction.recurringBudgetId ? data.transactions.find((item) => item.id === transaction.recurringBudgetId) : undefined;
      const trend = transaction.recurrence && !budgetProgress ? recurringTrend(transaction, data.transactions) : null;
      return <motion.div className={`transaction-item ${expanded ? "expanded" : ""}`} data-transaction-id={transaction.id} draggable={false} layout key={transaction.id} transition={{ layout: reducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }} onPointerDown={(event) => beginLongPress(event, transaction)} onPointerMove={moveLongPress} onPointerCancel={(event) => { if (event.pointerType !== "touch") cancelLongPress(); }} onPointerLeave={(event) => { if (event.pointerType === "mouse") cancelLongPress(); }} onClickCapture={(event) => { if (longPressTriggered.current) { event.preventDefault(); event.stopPropagation(); window.setTimeout(() => { longPressTriggered.current = false; }, 0); } }} onContextMenu={(event) => { if (transaction.type === "expense") { event.preventDefault(); window.getSelection()?.removeAllRanges(); setActionTransaction(transaction); } }}>
        <motion.div className={`timeline-row status-${status}`} layout="position">
          <button className={`type-icon status-${status}`} onClick={() => setExpandedId(expanded ? null : transaction.id)} aria-label={`${expanded ? "Collapse" : "Expand"} ${transaction.name}`}>{transaction.paymentMethod === "amex" ? <CreditCard /> : transaction.type === "income" ? <ArrowDownLeft /> : transaction.type === "transfer" ? <ArrowLeftRight /> : <ArrowUpRight />}</button>
          <button className="timeline-main" onClick={() => setExpandedId(expanded ? null : transaction.id)} aria-expanded={expanded}><span><strong>{transaction.name}</strong>{transaction.paymentMethod === "amex" ? <small className="amex-badge">Amex</small> : null}{budgetProgress ? <small className="budget-badge">Budget</small> : null}</span><small>{budgetProgress ? `${formatMoney(budgetProgress.spent, true)} used of ${formatMoney(budgetProgress.planned, true)}` : `${transaction.category ?? fundName} · ${formatDate(transaction.date)}`}</small></button>
          <button className={`timeline-amount status-${status} ${budgetProgress ? "budget-remaining-amount" : ""}`} onClick={() => setExpandedId(expanded ? null : transaction.id)}>{budgetProgress ? <small>left</small> : null}<span>{budgetProgress ? "" : transaction.type === "income" ? "+" : transaction.type === "expense" ? "−" : ""}{formatMoney(budgetProgress?.remaining ?? transaction.amount)}</span></button>
          <button className="transaction-quick-edit" onClick={() => openTransactionSheet(transaction)} aria-label={`Edit ${transaction.name}`}><Pencil size={15} /></button>
        </motion.div>
        <AnimatePresence initial={false}>
          {expanded ? <motion.div
            className="transaction-expanded"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="transaction-detail-grid">
              <span><small>Date</small><strong>{formatDate(transaction.date, { day: "numeric", month: "short", year: "numeric" })}</strong></span>
              <span><small>Fund</small><strong>{fundName}</strong></span>
              <span><small>Type</small><strong>{budgetProgress ? "Spending budget" : transaction.recurrence ? "Recurring" : transaction.paymentMethod === "amex" ? "Amex expense" : transaction.type}</strong></span>
            </div>
            {budgetProgress ? <div className="recurring-insight recurring-budget-insight">
              <span><small>Cycle budget</small><strong>{formatMoney(budgetProgress.planned)}</strong></span>
              <span><small>Actually spent</small><strong>{formatMoney(budgetProgress.spent)}</strong></span>
              <span><small>{budgetProgress.over > 0 ? "Over budget" : "Still available"}</small><strong className={budgetProgress.over > 0 ? "negative-text" : "positive-text"}>{formatMoney(budgetProgress.over || budgetProgress.remaining)}</strong></span>
            </div> : null}
            {trend ? <div className="recurring-insight">
              <span><small>3-month average</small><strong>{formatMoney(trend.average)}</strong></span>
              <span><small>Delta vs average</small><strong className={trend.delta > 0 ? "negative-text" : "positive-text"}>{trend.delta > 0 ? "+" : trend.delta < 0 ? "−" : ""}{formatMoney(Math.abs(trend.delta))}</strong></span>
              <RecurringSparkline values={trend.values} reducedMotion={Boolean(reducedMotion)} />
            </div> : null}
            {linkedBudget ? <p className="transaction-budget-link">Taken from recurring budget <strong>{linkedBudget.name}</strong>. Payment remains {transaction.paymentMethod === "amex" ? "American Express" : "bank account"}.</p> : null}
            {transaction.notes ? <p className="transaction-note">{transaction.notes}</p> : null}
            <div className="transaction-expanded-actions">
              <button onClick={() => openTransactionSheet(transaction)}><Pencil size={14} /> Edit</button>
              <button onClick={() => duplicateTransaction(transaction)}><Copy size={14} /> Duplicate</button>
              <button className="danger" onClick={() => removeTransaction(transaction)}><Trash2 size={14} /> Delete</button>
            </div>
          </motion.div> : null}
        </AnimatePresence>
      </motion.div>;
      })}</motion.div></motion.section>)}{!filtered.length ? <motion.div className="empty-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}><Search size={24} /><h2>{filter === "ev_charging" ? "No charging expenses yet" : "No transactions found"}</h2><p>{filter === "ev_charging" ? "Link your next charge to the EV charging budget." : "Try another search or add a new transaction."}</p></motion.div> : null}</motion.div>
    </motion.div>

    <AnimatePresence>
      {actionTransaction ? <motion.div className="flow-dialog-layer" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="flow-dialog-backdrop" aria-label="Close expense actions" onClick={(event) => {
          if (longPressTriggered.current) {
            event.preventDefault();
            event.stopPropagation();
            longPressTriggered.current = false;
            return;
          }
          setActionTransaction(null);
        }} />
        <motion.section className="expense-action-menu card" role="dialog" aria-modal="true" aria-labelledby="expense-action-title" initial={reducedMotion ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: reducedMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}>
          <header><div><small>Expense</small><h2 id="expense-action-title">{actionTransaction.name}</h2></div><button className="icon-button" onClick={() => setActionTransaction(null)} aria-label="Close"><X size={18} /></button></header>
          <p>{formatMoney(actionTransaction.amount)} · {actionTransaction.paymentMethod === "amex" ? "American Express" : "Bank account"}</p>
          <div><button onClick={() => { const transaction = actionTransaction; setActionTransaction(null); openTransactionSheet(transaction); }}><Pencil size={17} /> Edit expense</button><button className="danger" onClick={() => { const transaction = actionTransaction; setActionTransaction(null); void removeTransaction(transaction); }}><Trash2 size={17} /> Delete expense</button></div>
        </motion.section>
      </motion.div> : null}
      {legendOpen ? <motion.div className="flow-dialog-layer" initial={reducedMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
        <button className="flow-dialog-backdrop" aria-label="Close colour guide" onClick={() => setLegendOpen(false)} />
        <motion.section className="colour-legend-dialog card" role="dialog" aria-modal="true" aria-labelledby="colour-guide-title" initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}>
          <header><div><span>Transactions</span><h2 id="colour-guide-title">Colour guide</h2></div><button className="icon-button" onClick={() => setLegendOpen(false)} aria-label="Close"><X size={18} /></button></header>
          <div className="colour-legend-list">
            <div><i className="status-income" /><span><strong>Income</strong><small>Money coming in</small></span></div>
            <div><i className="status-expense" /><span><strong>Expense</strong><small>Money going out</small></span></div>
            <div><i className="status-recurring-upcoming" /><span><strong>Recurring · due</strong><small>Payment date is still upcoming</small></span></div>
            <div><i className="status-recurring-passed" /><span><strong>Recurring · passed</strong><small>Payment date has already passed</small></span></div>
            <div><i className="status-amex" /><span><strong>Amex badge</strong><small>Paid with American Express</small></span></div>
          </div>
        </motion.section>
      </motion.div> : null}
    </AnimatePresence>
  </div>;
}

function recurringTrend(transaction: Transaction, transactions: Transaction[]) {
  const comparable = transactions
    .filter((item) => item.type === "expense" && item.name.trim().toLowerCase() === transaction.name.trim().toLowerCase() && item.date <= new Date().toISOString().slice(0, 10))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-3)
    .map((item) => item.amount);
  while (comparable.length < 3) comparable.unshift(transaction.amount);
  const average = comparable.reduce((sum, amount) => sum + amount, 0) / comparable.length;
  return { values: comparable, average, delta: transaction.amount - average };
}

function RecurringSparkline({ values, reducedMotion }: { values: number[]; reducedMotion: boolean }) {
  const width = 92;
  const height = 34;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = Math.max(1, max - min);
  const path = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : index * width / (values.length - 1);
    const y = height - 4 - ((value - min) / range) * (height - 8);
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");

  return <svg className="recurring-sparkline" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Recent recurring expense trend">
    <motion.path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" initial={reducedMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 1 }} transition={{ duration: reducedMotion ? 0 : 0.5, ease: [0.22, 1, 0.36, 1] }} />
  </svg>;
}
