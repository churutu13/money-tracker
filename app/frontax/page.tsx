"use client";

import { FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Calculator, CalendarDays, ChevronDown, Pencil, ReceiptText, Save, Trash2, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { NumberInput } from "@/components/number-input";
import { useConfirm } from "@/components/confirm-provider";
import { useFlow } from "@/components/app-provider";
import { calculateItalianTaxBeforeDeductions, forecastFrontax, frontaxEntriesForYear, frontaxReserveProgress, projectedMonthlySetAside } from "@/lib/frontax";
import { formatMoney } from "@/lib/format";
import { overtimeHoursForMonth, overtimeTaxProjection } from "@/lib/overtime";
import type { FrontaxEntry } from "@/lib/types";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const currentDate = new Date();
type FrontaxSectionKey = "monthly" | "adjustments" | "payslip" | "entered" | "actual";
type FrontaxSectionState = Record<FrontaxSectionKey, boolean>;
const FRONTAX_SECTIONS_KEY = "flow.frontax-sections.v1";
const DEFAULT_FRONTAX_SECTIONS: FrontaxSectionState = { monthly: true, adjustments: true, payslip: true, entered: true, actual: true };

const blankEntry = (year: number, month: number): FrontaxEntry => ({
  id: `${year}-${String(month).padStart(2, "0")}`,
  year,
  month,
  grossIncomeChf: 0,
  netIncomeChf: 0,
  socialContributionsChf: 0,
  taxAtSourceChf: 0,
  exchangeRate: 0.937,
  updatedAt: "",
});

export default function FrontaxPage() {
  const { data, hydrated, saveFrontaxEntry, deleteFrontaxEntry, updateFrontaxYearAdjustments, updateSalary } = useFlow();
  const confirm = useConfirm();
  const [year, setYear] = useState(currentDate.getFullYear());
  const [month, setMonth] = useState(currentDate.getMonth() + 1);
  const [draft, setDraft] = useState(() => blankEntry(currentDate.getFullYear(), currentDate.getMonth() + 1));
  const [overtimeHours, setOvertimeHours] = useState(0);
  const [notice, setNotice] = useState("");
  const [openSections, setOpenSections] = useState<FrontaxSectionState>(DEFAULT_FRONTAX_SECTIONS);
  const sectionStateReady = useRef(false);
  const editorRef = useRef<HTMLFormElement>(null);

  const savedEntries = useMemo(() => frontaxEntriesForYear(data.frontaxEntries, year), [data.frontaxEntries, year]);
  const existing = savedEntries.find((entry) => entry.month === month);
  const adjustments = data.frontaxYearAdjustments?.[String(year)] ?? { deductionsEur: 0, priorAdvancesEur: 0 };

  useEffect(() => {
    if (!hydrated) return;
    const saved = (data.frontaxEntries ?? []).find((entry) => entry.year === year && entry.month === month);
    // Keep the editor in sync when persisted data finishes hydrating or the selected month changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDraft(saved ? { ...saved } : blankEntry(year, month));
    const key = `${year}-${String(month).padStart(2, "0")}`;
    setOvertimeHours(data.salaryProfiles.reduce((sum, profile) => sum + (profile.monthlyOvertime?.[key]?.hours ?? 0), 0));
  }, [data.frontaxEntries, data.salaryProfiles, hydrated, month, year]);

  useEffect(() => {
    const stored = localStorage.getItem(FRONTAX_SECTIONS_KEY);
    // Restore the user's UI preference after client hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setOpenSections({ ...DEFAULT_FRONTAX_SECTIONS, ...JSON.parse(stored) as Partial<FrontaxSectionState> });
    const frame = window.requestAnimationFrame(() => { sectionStateReady.current = true; });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const previewEntries = useMemo(() => {
    const withoutSelected = savedEntries.filter((entry) => entry.month !== month);
    return [...withoutSelected, draft].sort((a, b) => a.month - b.month);
  }, [draft, month, savedEntries]);
  const currentEstimate = calculateItalianTaxBeforeDeductions(previewEntries);
  const projection = forecastFrontax(previewEntries.filter((entry) => entry.grossIncomeChf > 0 || entry.taxAtSourceChf > 0 || entry.socialContributionsChf > 0), year, adjustments);
  const overtimeProjection = overtimeTaxProjection(data.salaryProfiles, year, currentDate);
  const selectedOvertimeHours = overtimeHours;
  const totalCashTarget = projection.projectedReserve;
  const selectedMonthSetAside = projectedMonthlySetAside(projection.projectedEntries, draft, projection.projectedReserve);
  const selectedProgress = frontaxReserveProgress(projection.projectedEntries, projection.projectedReserve, month);
  const recommendedThroughMonth = selectedProgress.recommendedToDate;
  const yearOptions = Array.from({ length: 4 }, (_, index) => currentDate.getFullYear() - 2 + index);

  function choosePeriod(nextYear: number, nextMonth: number, returnToEditor = false) {
    setYear(nextYear);
    setMonth(nextMonth);
    const saved = (data.frontaxEntries ?? []).find((entry) => entry.year === nextYear && entry.month === nextMonth);
    setDraft(saved ? { ...saved } : blankEntry(nextYear, nextMonth));
    const key = `${nextYear}-${String(nextMonth).padStart(2, "0")}`;
    setOvertimeHours(data.salaryProfiles.reduce((sum, profile) => sum + (profile.monthlyOvertime?.[key]?.hours ?? 0), 0));
    if (returnToEditor) {
      setOpenSections((current) => {
        const next = { ...current, payslip: true };
        localStorage.setItem(FRONTAX_SECTIONS_KEY, JSON.stringify(next));
        return next;
      });
      window.requestAnimationFrame(() => window.requestAnimationFrame(() => editorRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })));
    }
  }

  function update(field: keyof Pick<FrontaxEntry, "grossIncomeChf" | "netIncomeChf" | "socialContributionsChf" | "taxAtSourceChf" | "exchangeRate">, value: number | undefined) {
    setDraft((current) => ({ ...current, [field]: Math.max(0, value ?? 0) }));
  }

  function rememberSection(key: FrontaxSectionKey, open: boolean) {
    if (!sectionStateReady.current) return;
    setOpenSections((current) => {
      if (current[key] === open) return current;
      const next = { ...current, [key]: open };
      localStorage.setItem(FRONTAX_SECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2600);
  }

  function saveMonth(event: FormEvent) {
    event.preventDefault();
    if (draft.grossIncomeChf <= 0 || draft.exchangeRate <= 0) {
      flash("Add gross salary and a valid exchange rate");
      return;
    }
    saveFrontaxEntry({ ...draft, id: existing?.id ?? `${year}-${String(month).padStart(2, "0")}`, year, month, updatedAt: new Date().toISOString() });
    const salary = data.salaryProfiles[0];
    if (salary) {
      const key = `${year}-${String(month).padStart(2, "0")}`;
      updateSalary({ ...salary, monthlyOvertime: { ...(salary.monthlyOvertime ?? {}), [key]: { ...(salary.monthlyOvertime?.[key] ?? {}), hours: overtimeHours } } });
    }
    flash(`${MONTHS[month - 1]} saved`);
  }

  async function removeMonth(entry: FrontaxEntry) {
    const approved = await confirm({ title: "Delete monthly tax data?", message: `${MONTHS[entry.month - 1]} ${entry.year} will be removed from the Frontax estimate.`, confirmLabel: "Delete", danger: true });
    if (!approved) return;
    deleteFrontaxEntry(entry.id);
    if (entry.month === month && entry.year === year) setDraft(blankEntry(year, month));
    flash(`${MONTHS[entry.month - 1]} deleted`);
  }

  return <div className="content-wrap frontax-page">
    <PageHeader eyebrow="Tax estimate" title="Frontax" subtitle="Estimate what to set aside from your Swiss salary." />
    {notice ? <div className="toast" role="status">{notice}</div> : null}

    <section className="frontax-forecast-primary card">
      <header><span><TrendingUp size={17} /></span><div><strong>Forecast to December</strong><small>Future empty months use the average of the months entered so far.</small></div><span className="month-pill">{year}</span></header>
      <div className="frontax-forecast-total"><span>Total cash target</span><strong>{formatMoney(totalCashTarget)}</strong><small>Italian balance plus next-year advance. {overtimeProjection.projectedHours.toLocaleString("en-IE", { maximumFractionDigits: 1 })} overtime hours are already reflected in the entered payslip amounts.</small></div>
    </section>

    <details className="frontax-collapsible home-collapsible-section" open={openSections.monthly} onToggle={(event) => rememberSection("monthly", event.currentTarget.open)}>
      <FrontaxSectionSummary title="Monthly set-aside" icon={<CalendarDays size={18} />} preview={formatMoney(selectedMonthSetAside, true)} />
      <article className="frontax-month-target card"><span>Set aside for {MONTHS[month - 1]}</span><strong>{formatMoney(selectedMonthSetAside)}</strong><small>Weighted by this month’s net salary. The {selectedOvertimeHours.toLocaleString("en-IE", { maximumFractionDigits: 1 })} overtime hours are informational because their pay is already included in the payslip.</small><div className="frontax-month-progress"><span><small>Recommended through {MONTHS[month - 1]}</small><strong>{formatMoney(recommendedThroughMonth)}</strong></span><span><small>Remaining after {MONTHS[month - 1]}</small><strong>{formatMoney(Math.max(0, totalCashTarget - recommendedThroughMonth))}</strong></span></div></article>
    </details>

    <details className="frontax-collapsible home-collapsible-section" open={openSections.adjustments} onToggle={(event) => rememberSection("adjustments", event.currentTarget.open)}>
      <FrontaxSectionSummary title="Projection adjustments" icon={<ReceiptText size={18} />} preview={year} />
      <div className="frontax-adjustments frontax-adjustments-inline card">
        <div className="frontax-adjustment-inputs">
          <FrontaxInput label="Other deductions" hint="Annual deductions entered manually" suffix="EUR" value={adjustments.deductionsEur} onChange={(value) => updateFrontaxYearAdjustments(year, { ...adjustments, deductionsEur: Math.max(0, value ?? 0) })} />
          <FrontaxInput label="Advances already paid" hint="Reduces the projected balance only" suffix="EUR" value={adjustments.priorAdvancesEur} onChange={(value) => updateFrontaxYearAdjustments(year, { ...adjustments, priorAdvancesEur: Math.max(0, value ?? 0) })} />
        </div>
        <div className="frontax-tax-breakdown">
          <span><small>Projected Italian taxes</small><strong>{formatMoney(projection.projectedResult.estimatedItalianTax, true)}</strong></span>
          <span><small>Balance still due</small><strong>{formatMoney(projection.projectedResult.balanceDue, true)}</strong></span>
          <span><small>Next-year advance</small><strong>{formatMoney(projection.projectedResult.nextYearAdvance, true)}</strong></span>
          <span className="frontax-tax-total"><small>Total cash target</small><strong>{formatMoney(totalCashTarget)}</strong></span>
        </div>
      </div>
    </details>

    <details className="frontax-collapsible home-collapsible-section" open={openSections.payslip} onToggle={(event) => rememberSection("payslip", event.currentTarget.open)}>
      <FrontaxSectionSummary title="Monthly payslip" icon={<ReceiptText size={18} />} preview={`${MONTHS[month - 1]} ${year}`} />
    <form ref={editorRef} className="frontax-entry card" onSubmit={saveMonth}>
      <header><div><span>Monthly payslip</span><strong>{existing ? "Edit saved month" : "Add a month"}</strong></div><div className="frontax-period">
        <select aria-label="Salary month" value={month} onChange={(event) => choosePeriod(year, Number(event.target.value))}>{MONTHS.map((label, index) => <option key={label} value={index + 1}>{label}</option>)}</select>
        <select aria-label="Salary year" value={year} onChange={(event) => choosePeriod(Number(event.target.value), month)}>{yearOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select>
      </div></header>
      <div className="frontax-input-grid">
        <FrontaxInput label="Gross salary" hint="Gross income on your payslip" suffix="CHF" value={draft.grossIncomeChf} onChange={(value) => update("grossIncomeChf", value)} />
        <FrontaxInput label="Net salary" hint="Amount actually paid to you" suffix="CHF" value={draft.netIncomeChf} onChange={(value) => update("netIncomeChf", value)} />
        <FrontaxInput label="Social contributions" hint="Swiss social deductions" suffix="CHF" value={draft.socialContributionsChf} onChange={(value) => update("socialContributionsChf", value)} />
        <FrontaxInput label="Withholding tax" hint="Tax paid at source" suffix="CHF" value={draft.taxAtSourceChf} onChange={(value) => update("taxAtSourceChf", value)} />
        <FrontaxInput label="Exchange rate" hint="CHF equivalent of €1" suffix="CHF/€" value={draft.exchangeRate} step="0.001" onChange={(value) => update("exchangeRate", value)} />
        <FrontaxInput label="Overtime hours" hint="Informational · pay is already in gross and net" suffix="hours" value={overtimeHours} step="0.1" onChange={(value) => setOvertimeHours(Math.max(0, value ?? 0))} />
      </div>
      <footer><span>Frontax uses the current local MVP calculation and does not change your Flow balances.</span><div>{existing ? <button className="frontax-delete" type="button" onClick={() => removeMonth(existing)}><Trash2 size={15} /> Delete</button> : null}<button className="primary-button" type="submit"><Save size={15} /> Save month</button></div></footer>
    </form>
    </details>

    <details className="frontax-history frontax-collapsible home-collapsible-section frontax-entered" open={openSections.entered} onToggle={(event) => rememberSection("entered", event.currentTarget.open)}>
      <summary className="home-menu-summary section-title-row">
        <span className="home-menu-collapsed-title">Entered months</span>
        <span className="home-menu-expanded-title home-menu-section-title">Entered months</span>
        <span className="home-menu-preview month-pill">{year}</span>
        <span className="home-menu-arrow"><ChevronDown size={18} /></span>
      </summary>
      {savedEntries.length ? <div className="frontax-month-list card">{savedEntries.map((entry) => <div className="frontax-month-row" key={entry.id}><span className="frontax-month-icon"><CalendarDays size={16} /></span><button className="frontax-month-main" onClick={() => choosePeriod(entry.year, entry.month, true)}><strong>{MONTHS[entry.month - 1]}</strong><small>{entry.grossIncomeChf.toLocaleString("en-IE", { maximumFractionDigits: 2 })} CHF gross · {entry.netIncomeChf.toLocaleString("en-IE", { maximumFractionDigits: 2 })} CHF net · {overtimeHoursForMonth(data.salaryProfiles, entry.year, entry.month).toLocaleString("en-IE", { maximumFractionDigits: 1 })} overtime hours</small></button><strong>{formatMoney(projectedMonthlySetAside(projection.projectedEntries, entry, projection.projectedReserve), true)}</strong><button className="frontax-row-edit" onClick={() => choosePeriod(entry.year, entry.month, true)} aria-label={`Edit ${MONTHS[entry.month - 1]}`}><Pencil size={15} /></button></div>)}</div> : <div className="empty-state card"><CalendarDays size={24} /><h2>No months entered for {year}</h2><p>Add your first payslip above. The estimate will grow month by month.</p></div>}
    </details>

    <details className="frontax-actual-estimate frontax-collapsible home-collapsible-section" open={openSections.actual} onToggle={(event) => rememberSection("actual", event.currentTarget.open)}>
      <FrontaxSectionSummary title="Estimated Italian taxes" icon={<Calculator size={18} />} preview={formatMoney(currentEstimate.estimatedItalianTax, true)} />
      <article className="frontax-tax-card card"><span>Italian taxes accrued so far</span><strong>{formatMoney(currentEstimate.estimatedItalianTax)}</strong><small>Uses entered months only. Employment deductions, Swiss withholding tax credit, “Other deductions” and “Advances already paid” are all excluded.</small></article>
    </details>
  </div>;
}

function FrontaxSectionSummary({ title, icon, preview }: { title: string; icon: ReactNode; preview?: ReactNode }) {
  return <summary className="home-menu-summary section-title-row">
    <span className="home-menu-collapsed-title">{title}</span>
    <span className="home-menu-expanded-title home-menu-section-title"><span className="home-summary-icon frontax-summary-icon">{icon}</span>{title}</span>
    {preview !== undefined ? <span className="home-menu-preview month-pill">{preview}</span> : <span />}
    <span className="home-menu-arrow"><ChevronDown size={18} /></span>
  </summary>;
}

function FrontaxInput({ label, hint, suffix, value, step = "0.01", onChange }: { label: string; hint: string; suffix: string; value: number; step?: string; onChange: (value: number | undefined) => void }) {
  return <label className="frontax-input"><span><strong>{label}</strong><small>{hint}</small></span><span className="frontax-number"><NumberInput min="0" step={step} value={value} onValueChange={onChange} aria-label={label} /><small>{suffix}</small></span></label>;
}
