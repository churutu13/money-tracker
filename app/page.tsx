"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { CalendarClock, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, CreditCard, PiggyBank, ShieldCheck, WalletCards } from "lucide-react";
import { AnimatedMoney } from "@/components/animated-money";
import { PageHeader } from "@/components/page-header";
import { FundAccounts } from "@/components/fund-accounts";
import { NumberInput } from "@/components/number-input";
import { useFlow } from "@/components/app-provider";
import { getAmexSummary, getCycleEntry, getRecurringBudgetProgress, recurrenceDatesInRange } from "@/lib/engine";
import { forecastFrontax, frontaxEntriesForYear, frontaxReserveProgress } from "@/lib/frontax";
import { formatMoney } from "@/lib/format";
import type { CycleEntry } from "@/lib/types";

type HomeSectionKey = "amex" | "cycle" | "upcoming" | "reserves";
type HomeSectionState = Record<HomeSectionKey, boolean>;

const HOME_SECTIONS_KEY = "flow.home-sections.v1";
const DEFAULT_HOME_SECTIONS: HomeSectionState = { amex: true, cycle: true, upcoming: true, reserves: true };

type SalaryBreakdown = { id: string; salary: number; taxReserve: number; upcomingBills: number };

export default function HomePage() {
  const { data, hydrated, openTransactionSheet, updateFund, updateSalary } = useFlow();
  const [openSections, setOpenSections] = useState<HomeSectionState>(DEFAULT_HOME_SECTIONS);
  const [salaryBreakdown, setSalaryBreakdown] = useState<SalaryBreakdown | null>(null);
  const [cashGlow, setCashGlow] = useState(false);
  const collapseStateReady = useRef(false);
  const seenTransactions = useRef<Set<string> | null>(null);
  const previousAvailable = useRef<number | null>(null);
  const breakdownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reducedMotion = useReducedMotion();
  const available = data.funds.find((fund) => fund.kind === "available")?.balance ?? 0;
  const taxFund = data.funds.find((fund) => fund.kind === "tax");
  const savingsFund = data.funds.find((fund) => fund.kind === "savings");
  const tax = taxFund?.balance ?? 0;
  const savings = savingsFund?.balance ?? 0;
  const now = new Date();
  const currentYear = now.getFullYear();
  const frontaxEntries = frontaxEntriesForYear(data.frontaxEntries, currentYear);
  const frontaxProjection = forecastFrontax(frontaxEntries, currentYear, data.frontaxYearAdjustments?.[String(currentYear)]);
  const frontaxTax = frontaxProjection.projectedReserve;
  const frontaxProgress = frontaxReserveProgress(frontaxProjection.projectedEntries, frontaxProjection.projectedReserve, now.getMonth() + 1);
  const taxTarget = frontaxEntries.length ? frontaxTax : data.settings.expectedTaxBill;
  const currentTaxTarget = frontaxEntries.length ? frontaxProgress.recommendedToDate : taxTarget;
  const cycleEntry = getCycleEntry(data);
  const primarySalary = data.salaryProfiles[0];
  const cycleOvertime = primarySalary?.monthlyOvertime?.[cycleEntry.key]?.hours ?? 0;
  const amex = getAmexSummary(data);
  const afterAmex = available - amex.unreservedOutstanding;
  const taxProgress = taxTarget > 0 ? Math.min(100, (tax / taxTarget) * 100) : 0;
  const tomorrow = new Date();
  tomorrow.setHours(12, 0, 0, 0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const recurringUpcoming = data.transactions
    .flatMap((transaction) => transaction.type === "expense" && transaction.recurrence
      ? recurrenceDatesInRange(transaction.recurrence, tomorrow, cycleEntry.cycle.end).map((date) => ({
        transaction,
        date,
        amount: transaction.recurrence?.spendingBudget ? getRecurringBudgetProgress(data, transaction).remaining : transaction.amount,
      }))
      : [])
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const upcoming = recurringUpcoming.slice(0, 5);
  const upcomingBills = recurringUpcoming.reduce((sum, item) => sum + item.amount, 0);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(HOME_SECTIONS_KEY);
      if (stored) setOpenSections({ ...DEFAULT_HOME_SECTIONS, ...JSON.parse(stored) as Partial<HomeSectionState> });
    } finally {
      const frame = window.requestAnimationFrame(() => { collapseStateReady.current = true; });
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const currentIds = new Set(data.transactions.map((transaction) => transaction.id));
    if (!seenTransactions.current) {
      seenTransactions.current = currentIds;
      previousAvailable.current = available;
      return;
    }

    const newIncome = data.transactions.find((transaction) => !seenTransactions.current?.has(transaction.id) && transaction.type === "income");
    const availableIncreased = previousAvailable.current !== null && available > previousAvailable.current + 0.009;
    seenTransactions.current = currentIds;
    previousAvailable.current = available;

    if (availableIncreased && !reducedMotion) {
      setCashGlow(true);
      if (glowTimer.current) clearTimeout(glowTimer.current);
      glowTimer.current = setTimeout(() => setCashGlow(false), 1150);
    }

    if (newIncome) {
      const taxReserve = primarySalary?.taxStrategy === "percentage"
        ? newIncome.amount * primarySalary.taxValue / 100
        : primarySalary?.taxStrategy === "fixed"
          ? primarySalary.taxValue
          : 0;
      setSalaryBreakdown({ id: newIncome.id, salary: newIncome.amount, taxReserve, upcomingBills });
      if (breakdownTimer.current) clearTimeout(breakdownTimer.current);
      breakdownTimer.current = setTimeout(() => setSalaryBreakdown(null), reducedMotion ? 1800 : 2800);
    }
  }, [available, data.transactions, hydrated, primarySalary, reducedMotion, upcomingBills]);

  useEffect(() => () => {
    if (breakdownTimer.current) clearTimeout(breakdownTimer.current);
    if (glowTimer.current) clearTimeout(glowTimer.current);
  }, []);

  function rememberSection(key: HomeSectionKey, open: boolean) {
    if (!collapseStateReady.current) return;
    setOpenSections((current) => {
      if (current[key] === open) return current;
      const next = { ...current, [key]: open };
      localStorage.setItem(HOME_SECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function updateCycleValue(field: keyof CycleEntry, value: number | undefined) {
    if (!cycleEntry.fund) return;
    const next = { ...cycleEntry.values, [field]: Math.max(0, value ?? 0) };
    updateFund({ ...cycleEntry.fund, cycleEntries: { ...(cycleEntry.fund.cycleEntries ?? {}), [cycleEntry.key]: next } });
  }

  function updateCycleOvertime(value: number | undefined) {
    if (!primarySalary) return;
    const current = primarySalary.monthlyOvertime?.[cycleEntry.key] ?? { hours: 0 };
    updateSalary({ ...primarySalary, monthlyOvertime: { ...(primarySalary.monthlyOvertime ?? {}), [cycleEntry.key]: { ...current, hours: Math.max(0, value ?? 0) } } });
  }

  return <div className="content-wrap">
    <PageHeader eyebrow="Today" title="Good afternoon" subtitle="Your money, organised around payday." />

    <section className="home-hero home-cash-hero">
      <motion.article
        layout
        className="balance-card card"
        animate={{ boxShadow: cashGlow ? "0 22px 52px rgba(40, 160, 112, .34), 0 0 0 1px rgba(118, 201, 170, .22)" : "0 22px 45px rgba(12, 50, 40, .16)" }}
        transition={{ duration: reducedMotion ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="balance-topline"><span>Available Cash</span><WalletCards size={19} /></div>
        <AnimatedMoney value={available} duration={0.6} />
        <AnimatePresence initial={false}>
          {salaryBreakdown ? <motion.div
            key={salaryBreakdown.id}
            className="salary-breakdown"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { height: 0, opacity: 0 }}
            transition={{ duration: reducedMotion ? 0 : 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            {[
              ["Salary", salaryBreakdown.salary],
              ["Tax reserve", -salaryBreakdown.taxReserve],
              ["Upcoming reserved bills", -salaryBreakdown.upcomingBills],
            ].map(([label, value], index) => <motion.div
              key={String(label)}
              initial={reducedMotion ? false : { opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: reducedMotion ? 0 : index * 0.08, duration: reducedMotion ? 0 : 0.24 }}
            ><span>{label}</span><strong>{Number(value) >= 0 ? "+" : "−"}{formatMoney(Math.abs(Number(value)), true)}</strong></motion.div>)}
          </motion.div> : null}
        </AnimatePresence>
        <p>Income − fixed for this pay cycle</p><div className="balance-divider" />
        <div className="available-split"><div><span>After unreserved Amex</span><strong className={afterAmex < 0 ? "negative-text" : ""}>{formatMoney(afterAmex)}</strong></div><div><span>Still to set aside</span><strong>{formatMoney(amex.unreservedOutstanding)}</strong></div></div>
      </motion.article>
      <details className="amex-home-card card home-collapsible-card" open={openSections.amex} onToggle={(event) => rememberSection("amex", event.currentTarget.open)}>
        <summary className="home-menu-summary">
          <span className="home-menu-collapsed-title">Amex</span>
          <span className="home-menu-expanded-title reserve-heading"><span className="reserve-icon amex-icon"><CreditCard size={18} /></span><span>Amex · current cycle</span></span>
          <strong className="home-menu-preview">{formatMoney(amex.total)}</strong>
          <span className="home-menu-arrow"><ChevronDown size={18} /></span>
        </summary>
        <div className="amex-home-body"><p>{amex.cycle.label} · debit {amex.cycle.dueDate.toLocaleDateString("en-IE", { day: "numeric", month: "short" })}</p>
          <div className="amex-home-progress"><span style={{ width: `${amex.total ? Math.min(100, (amex.reserved / amex.total) * 100) : 0}%` }} /></div>
          <div className="progress-copy"><span>{formatMoney(amex.reserved, true)} set aside</span><span>{formatMoney(amex.toReserve, true)} left</span></div>
          <Link className="amex-home-link" href="/amex">Manage Amex <ChevronRight size={14} /></Link>
        </div>
      </details>
    </section>

    {cycleEntry.fund ? <details className="cycle-ledger card home-collapsible-card" open={openSections.cycle} onToggle={(event) => rememberSection("cycle", event.currentTarget.open)}>
      <summary className="home-menu-summary cycle-ledger-summary">
        <span className="home-menu-collapsed-title">This pay cycle</span>
        <span className="home-menu-expanded-title"><span className="income-icon"><CircleDollarSign size={18} /></span><span className="home-menu-cycle-copy"><span>This pay cycle</span><strong>{cycleEntry.cycle.longLabel}</strong></span></span>
        <strong className="home-menu-preview">{formatMoney(cycleEntry.remaining, true)}</strong>
        <span className="home-menu-arrow"><ChevronDown size={18} /></span>
      </summary>
      <div className="cycle-ledger-link"><Link href="/settings">Manage fixed expenses <ChevronRight size={14} /></Link></div>
      <div className="cycle-ledger-note">Enter your totals for this cycle. Income, fixed and lifestyle start at zero each payday.</div>
      <div className="cycle-ledger-grid">
        <CycleInput label="Income" field="income" value={cycleEntry.values.income} cycleKey={cycleEntry.key} onChange={updateCycleValue} />
        <CycleInput label="Fixed" field="fixed" value={cycleEntry.values.fixed} cycleKey={cycleEntry.key} onChange={updateCycleValue} />
        <CycleInput label="Lifestyle" field="lifestyle" value={cycleEntry.values.lifestyle} cycleKey={cycleEntry.key} onChange={updateCycleValue} />
        <label className="cycle-input overtime-cycle-input"><span><CalendarClock size={15} />Overtime hours</span><div><NumberInput key={`${cycleEntry.key}-overtime`} min="0" step="0.1" value={cycleOvertime} onValueChange={updateCycleOvertime} aria-label="Overtime hours for current pay cycle" /><small>hours</small></div><small>Informational · included in payslip amounts</small></label>
        <div className={`cycle-result ${cycleEntry.remaining < 0 ? "negative" : ""}`}><span>Remaining</span><strong>{formatMoney(cycleEntry.remaining)}</strong><small>Income − fixed − lifestyle</small></div>
      </div>
    </details> : null}

    <section className="home-lower single-column-home">
      <details className="home-collapsible-section" open={openSections.upcoming} onToggle={(event) => rememberSection("upcoming", event.currentTarget.open)}><summary className="home-menu-summary section-title-row">
        <span className="home-menu-collapsed-title">Upcoming</span>
        <span className="home-menu-expanded-title home-menu-section-title"><span className="home-summary-icon"><CalendarClock size={18} /></span>Upcoming recurring</span>
        <span className="home-menu-preview home-collapse-label">{upcoming.length} upcoming</span>
        <span className="home-menu-arrow"><ChevronDown size={18} /></span>
      </summary><div className="home-section-action"><Link className="text-button" href="/transactions">See all</Link></div><div className="upcoming-list card">{upcoming.map(({ transaction, date, amount }) => <button key={`${transaction.id}-${date.toISOString()}`} className="transaction-row" onClick={() => openTransactionSheet(transaction)}><span className="transaction-date"><small>{date.toLocaleDateString("en-IE", { month: "short" })}</small><strong>{date.getDate()}</strong></span><span className="transaction-name"><strong>{transaction.name}</strong><small>{transaction.recurrence?.spendingBudget ? `${formatMoney(transaction.amount, true)} budget` : transaction.category ?? "Recurring"}</small></span><span className="transaction-amount">−{formatMoney(amount)}</span><ChevronRight size={16} /></button>)}</div></details>
    </section>

    <details className="reserve-bottom home-collapsible-section" open={openSections.reserves} onToggle={(event) => rememberSection("reserves", event.currentTarget.open)}>
      <summary className="home-menu-summary section-title-row">
        <span className="home-menu-collapsed-title">Savings and taxes</span>
        <span className="home-menu-expanded-title home-menu-section-title"><span className="home-summary-icon"><PiggyBank size={18} /></span>Savings & reserves</span>
        <span className="home-menu-preview month-pill"><CheckCircle2 size={13} /> Separate</span>
        <span className="home-menu-arrow"><ChevronDown size={18} /></span>
      </summary>
      <div className="fund-stack"><article className="savings-card card"><div className="reserve-heading"><span className="reserve-icon"><PiggyBank size={18} /></span><span>Savings</span></div><strong>{formatMoney(savings)}</strong><p>Your longer-term spendable balance</p>{savingsFund ? <FundAccounts fund={savingsFund} /> : null}</article><article className="reserve-card card">
        <div className="reserve-heading"><span className="reserve-icon"><ShieldCheck size={18} /></span><span>Tax Reserve</span></div>
        <strong>{formatMoney(tax)}</strong><p>Kept separate from available cash</p>
        <div className="progress-track"><span style={{ width: `${taxProgress}%` }} /></div><div className="progress-copy"><span>{Math.round(taxProgress)}% of annual target</span><span>{formatMoney(Math.max(0, taxTarget - tax), true)} to annual target</span></div>
        {frontaxEntries.length ? <div className="tax-target-pair"><span><small>Recommended by now</small><strong>{formatMoney(currentTaxTarget, true)}</strong></span><span><small>Annual target</small><strong>{formatMoney(taxTarget, true)}</strong></span></div> : null}
        {frontaxEntries.length ? <Link href="/frontax" className={`tax-track-status ${tax >= currentTaxTarget ? "on-track" : "behind"}`}><span>{tax >= currentTaxTarget ? "On track today" : "Behind today"}</span><strong>{tax >= currentTaxTarget ? `${formatMoney(tax - currentTaxTarget, true)} ahead` : `${formatMoney(currentTaxTarget - tax, true)} missing`}</strong><ChevronRight size={15} /></Link> : <Link href="/frontax" className="tax-track-status"><span>Frontax tracking</span><strong>Add your first month</strong><ChevronRight size={15} /></Link>}
        {taxFund ? <FundAccounts fund={taxFund} /> : null}
      </article></div>
    </details>
  </div>;
}

function CycleInput({ label, field, value, cycleKey, onChange }: { label: string; field: keyof CycleEntry; value: number; cycleKey: string; onChange: (field: keyof CycleEntry, value: number | undefined) => void }) {
  const icon = field === "income" ? <CircleDollarSign size={15} /> : field === "fixed" ? <CalendarClock size={15} /> : <WalletCards size={15} />;
  return <label className="cycle-input"><span>{icon}{label}</span><div><small>€</small><NumberInput key={`${cycleKey}-${field}`} min="0" step="0.01" value={value} onValueChange={(next) => onChange(field, next)} aria-label={`${label} for current pay cycle`} /></div></label>;
}
