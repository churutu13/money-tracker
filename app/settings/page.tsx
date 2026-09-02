"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  Check,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Database,
  Download,
  FileUp,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { useFlow } from "@/components/app-provider";
import { useConfirm } from "@/components/confirm-provider";
import { NumberInput } from "@/components/number-input";
import { getCycleEntry, getFinancialCycle } from "@/lib/engine";
import { formatMoney } from "@/lib/format";
import { OVERTIME_TAX_RESERVE_PER_HOUR, overtimeTaxReserve } from "@/lib/overtime";
import type { FlowData, Fund, SalaryProfile, Transaction } from "@/lib/types";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const formatFundBalance = (value: number) => formatMoney(value, true).replace("€", "").trim();
type SettingsSectionKey = "funds" | "fixed" | "salary" | "tax" | "planning" | "data";
type SettingsSectionState = Record<SettingsSectionKey, boolean>;
const SETTINGS_SECTIONS_KEY = "flow.settings-sections.v1";
const DEFAULT_SETTINGS_SECTIONS: SettingsSectionState = { funds: true, fixed: true, salary: true, tax: true, planning: true, data: true };

export default function SettingsPage() {
  const confirm = useConfirm();
  const {
    data,
    updateSettings,
    updateSalary,
    addSalary,
    deleteSalary,
    updateFund,
    addFund,
    deleteFund,
    deleteTransaction,
    openTransactionSheet,
    resetDemo,
    replaceData,
  } = useFlow();
  const [selectedSalaryId, setSelectedSalaryId] = useState<string | null>(data.salaryProfiles[0]?.id ?? null);
  const [newFundName, setNewFundName] = useState("");
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [notice, setNotice] = useState("");
  const [openSections, setOpenSections] = useState<SettingsSectionState>(DEFAULT_SETTINGS_SECTIONS);
  const importRef = useRef<HTMLInputElement>(null);
  const collapseStateReady = useRef(false);
  const salary = useMemo(
    () => data.salaryProfiles.find((item) => item.id === selectedSalaryId) ?? data.salaryProfiles[0],
    [data.salaryProfiles, selectedSalaryId],
  );
  const fixedExpenses = useMemo(
    () => data.transactions
      .filter((item) => item.type === "expense" && item.expenseKind !== "variable" && Boolean(item.recurrence))
      .sort((a, b) => (a.recurrence?.paymentDay ?? 1) - (b.recurrence?.paymentDay ?? 1)),
    [data.transactions],
  );
  const incomeSummary = getCycleEntry(data);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_SECTIONS_KEY);
      // Restore the user's UI preference after client hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setOpenSections({ ...DEFAULT_SETTINGS_SECTIONS, ...JSON.parse(stored) as Partial<SettingsSectionState> });
    } catch {
      localStorage.removeItem(SETTINGS_SECTIONS_KEY);
    } finally {
      const frame = window.requestAnimationFrame(() => { collapseStateReady.current = true; });
      return () => window.cancelAnimationFrame(frame);
    }
  }, []);

  function rememberSection(key: SettingsSectionKey, open: boolean) {
    if (!collapseStateReady.current) return;
    setOpenSections((current) => {
      if (current[key] === open) return current;
      const next = { ...current, [key]: open };
      localStorage.setItem(SETTINGS_SECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  function addCustomFund() {
    if (!newFundName.trim()) return;
    addFund({ id: crypto.randomUUID(), name: newFundName.trim(), balance: 0, kind: "custom" });
    setNewFundName("");
    flash("Fund added");
  }

  function createSalary() {
    const profile: SalaryProfile = {
      id: crypto.randomUUID(),
      name: "New salary",
      usableMonthlyIncome: 0,
      payday: 25,
      averageOvertimeHours: 0,
      overtimeNetRatio: 0.62,
      thirteenthSalaryMonths: [],
      taxStrategy: "manual",
      taxValue: 0,
      monthlyOvertime: {},
    };
    addSalary(profile);
    setSelectedSalaryId(profile.id);
  }

  async function installApp() {
    if (!installPrompt) {
      flash("On iPhone: Share → Add to Home Screen");
      return;
    }
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    flash(result.outcome === "accepted" ? "Flow installed" : "Installation cancelled");
    setInstallPrompt(null);
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `flow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    flash("Backup exported");
  }

  async function importData(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as FlowData;
      if (!parsed.funds || !parsed.transactions || !parsed.settings) throw new Error();
      replaceData(parsed);
      flash("Backup imported");
    } catch {
      flash("That file is not a valid Flow backup");
    } finally {
      event.target.value = "";
    }
  }

  return (
    <div className="content-wrap settings-wrap">
      <PageHeader title="Settings" subtitle="Choose how Flow calculates things." />
      {notice ? <div className="toast" role="status"><Check size={15} />{notice}</div> : null}

      <SettingsSection icon={<CircleDollarSign />} title="Funds" subtitle="Your available, saved and reserved money." open={openSections.funds} onToggle={(open) => rememberSection("funds", open)}>
        <div className="settings-card card">
          {data.funds.map((fund) => {
            const accountManaged = fund.kind === "income" || fund.kind === "savings" || fund.kind === "tax";
            return (
              <div className="setting-row fund-setting" key={fund.id}>
                <div>
                  <input className="setting-name-input" aria-label={`${fund.name} name`} value={fund.name} onChange={(event) => updateFund({ ...fund, name: event.target.value })} />
                  <small>{fund.kind === "income" ? `Recorded per pay cycle · ${incomeSummary.cycle.label}` : fund.kind === "tax" ? "Split by account from Home" : fund.kind === "available" ? "Monthly lifestyle wallet" : fund.kind === "savings" ? "Split by account from Home" : "Separate fund"}</small>
                </div>
                {accountManaged ? (
                  <span className="money-setting managed-balance">
                    <span className="fund-balance-number">{formatFundBalance(fund.kind === "income" ? incomeSummary.values.income : fund.balance)}</span>
                    <span>€</span>
                  </span>
                ) : (
                  <label className="money-setting">
                    <NumberInput aria-label={`${fund.name} balance`} value={fund.balance} step="0.01" onValueChange={(value) => { if (value !== undefined) updateFund({ ...fund, balance: value }); }} />
                    <span>€</span>
                  </label>
                )}
                {fund.kind === "custom" ? <button className="remove-setting" onClick={() => deleteFund(fund.id)} aria-label={`Delete ${fund.name}`}><Trash2 size={15} /></button> : <span className="row-spacer" />}
              </div>
            );
          })}
          <div className="setting-row add-fund">
            <Plus size={16} />
            <input value={newFundName} onChange={(event) => setNewFundName(event.target.value)} placeholder="Add a custom fund" aria-label="Custom fund name" onKeyDown={(event) => { if (event.key === "Enter") addCustomFund(); }} />
            <button onClick={addCustomFund}>Add</button>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection icon={<CalendarClock />} title="Fixed expenses" subtitle="Deducted from their fund once the payment date passes." open={openSections.fixed} onToggle={(open) => rememberSection("fixed", open)}>
        <FixedExpensesEditor
          expenses={fixedExpenses}
          funds={data.funds}
          onAdd={() => openTransactionSheet(undefined, "fixed")}
          onEdit={(transaction) => openTransactionSheet(transaction)}
          onDelete={async (transaction) => {
            const approved = await confirm({ title: "Delete fixed expense?", message: `“${transaction.name}” will be removed from every future cycle.`, confirmLabel: "Delete", danger: true });
            if (!approved) return;
            deleteTransaction(transaction.id);
            flash("Fixed expense deleted");
          }}
        />
      </SettingsSection>

      <SettingsSection icon={<UserRound />} title="Salary" subtitle="Income, payday and overtime profiles." open={openSections.salary} onToggle={(open) => rememberSection("salary", open)}>
        <div className="salary-tabs">
          <div>{data.salaryProfiles.map((profile) => <button key={profile.id} className={salary?.id === profile.id ? "active" : ""} onClick={() => setSelectedSalaryId(profile.id)}>{profile.name}</button>)}</div>
          <button className="icon-button" onClick={createSalary} aria-label="Add salary profile"><Plus size={16} /></button>
        </div>
        {salary ? (
          <SalaryEditor
            salary={salary}
            onChange={updateSalary}
            onDelete={() => {
              deleteSalary(salary.id);
              setSelectedSalaryId(data.salaryProfiles.find((item) => item.id !== salary.id)?.id ?? null);
            }}
          />
        ) : <button className="empty-state card add-empty" onClick={createSalary}><Plus size={22} /><h2>Add a salary profile</h2></button>}
      </SettingsSection>

      {salary ? (
        <SettingsSection icon={<ShieldCheck />} title="Tax Reserve" subtitle="Keep reserved tax outside spendable cash." open={openSections.tax} onToggle={(open) => rememberSection("tax", open)}>
          <div className="settings-card card">
            <label className="setting-row">
              <SettingCopy title="Strategy" subtitle="Applied to each salary profile" />
              <select value={salary.taxStrategy} onChange={(event) => updateSalary({ ...salary, taxStrategy: event.target.value as SalaryProfile["taxStrategy"] })}>
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed monthly</option>
                <option value="manual">Manual</option>
              </select>
            </label>
            <label className="setting-row">
              <SettingCopy title={salary.taxStrategy === "percentage" ? "Percentage" : "Monthly amount"} subtitle={salary.taxStrategy === "manual" ? "No automatic allocation" : "Suggested reserve transfer"} />
              <div className="inline-unit">
                <NumberInput disabled={salary.taxStrategy === "manual"} value={salary.taxValue} onValueChange={(value) => { if (value !== undefined) updateSalary({ ...salary, taxValue: value }); }} />
                <span>{salary.taxStrategy === "percentage" ? "%" : "EUR"}</span>
              </div>
            </label>
            <label className="setting-row">
              <SettingCopy title="Estimated future tax bill" subtitle="Used for reserve progress" />
              <NumberInput value={data.settings.expectedTaxBill} onValueChange={(value) => { if (value !== undefined) updateSettings({ ...data.settings, expectedTaxBill: value }); }} />
            </label>
            <div className="tax-suggestion">
              <span>Suggested next transfer</span>
              <strong>{formatMoney(salary.taxStrategy === "percentage" ? salary.usableMonthlyIncome * salary.taxValue / 100 : salary.taxStrategy === "fixed" ? salary.taxValue : 0)}</strong>
            </div>
          </div>
        </SettingsSection>
      ) : null}

      <SettingsSection icon={<Database />} title="Planning" subtitle="Control the safety built into your numbers." open={openSections.planning} onToggle={(open) => rememberSection("planning", open)}>
        <div className="settings-card card">
          <label className="setting-row">
            <SettingCopy title="Savings safety floor" subtitle="Shown as a planning cushion" />
            <NumberInput value={data.settings.safetyBuffer} onValueChange={(value) => { if (value !== undefined) updateSettings({ ...data.settings, safetyBuffer: value }); }} />
          </label>
          <label className="setting-row">
            <SettingCopy title="Monthly lifestyle wallet" subtitle="Used to refill Available Cash" />
            <NumberInput value={data.settings.monthlyLifestyleBudget} onValueChange={(value) => { if (value !== undefined) updateSettings({ ...data.settings, monthlyLifestyleBudget: value }); }} />
          </label>
        </div>
      </SettingsSection>

      <SettingsSection icon={<Download />} title="App & data" subtitle="Install, back up or restore Flow." open={openSections.data} onToggle={(open) => rememberSection("data", open)}>
        <div className="settings-card card">
          <button className="setting-row action-row" onClick={installApp}><SettingCopy title="Install Flow" subtitle="Add it to your home screen" /><ChevronRight size={17} /></button>
          <button className="setting-row action-row" onClick={exportData}><SettingCopy title="Export backup" subtitle="Download all your Flow data as JSON" /><Download size={17} /></button>
          <button className="setting-row action-row" onClick={() => importRef.current?.click()}><SettingCopy title="Import backup" subtitle="Restore a previous Flow JSON file" /><FileUp size={17} /></button>
          <input ref={importRef} className="hidden-input" type="file" accept="application/json" onChange={importData} />
          <div className="setting-row"><SettingCopy title="Data sync" subtitle={process.env.NEXT_PUBLIC_SUPABASE_URL ? "Supabase configured" : "Local-first · add Supabase keys to enable cloud sync"} /><span className="connected"><i /> {process.env.NEXT_PUBLIC_SUPABASE_URL ? "Configured" : "Local"}</span></div>
          <button className="setting-row action-row danger-row" onClick={() => { resetDemo(); flash("Demo data restored"); }}><SettingCopy title="Restore demo data" subtitle="Replace local changes with the sample plan" /><RotateCcw size={17} /></button>
        </div>
      </SettingsSection>
      <p className="settings-footer">Flow v2.0 · Calm money planning, without the accounting.</p>
    </div>
  );
}

function SettingsSection({ icon, title, subtitle, open, onToggle, children }: { icon: React.ReactNode; title: string; subtitle: string; open: boolean; onToggle: (open: boolean) => void; children: React.ReactNode }) {
  return <details className="settings-section settings-collapsible" open={open} onToggle={(event) => onToggle(event.currentTarget.open)}>
    <summary className="settings-menu-summary">
      <span className="settings-collapsed-title">{title}</span>
      <span className="settings-expanded-title settings-heading"><span className="setting-icon">{icon}</span><span><strong>{title}</strong><small>{subtitle}</small></span></span>
      <span className="settings-menu-arrow"><ChevronDown size={18} /></span>
    </summary>
    <div className="settings-section-body">{children}</div>
  </details>;
}

function SettingCopy({ title, subtitle }: { title: string; subtitle: string }) {
  return <div><strong>{title}</strong><small>{subtitle}</small></div>;
}

function FixedExpensesEditor({ expenses, funds, onAdd, onEdit, onDelete }: { expenses: Transaction[]; funds: Fund[]; onAdd: () => void; onEdit: (transaction: Transaction) => void; onDelete: (transaction: Transaction) => void }) {
  return (
    <div className="fixed-expenses-card card">
      {expenses.map((expense) => (
        <div className="fixed-expense-row" key={expense.id}>
          <button className="fixed-expense-main" onClick={() => onEdit(expense)}>
            <span><strong>{expense.name}</strong><small>Day {expense.recurrence?.paymentDay ?? "—"} · {funds.find((fund) => fund.id === expense.fundId)?.name ?? "No fund"} · {expense.category ?? "Fixed expense"}</small></span>
            <strong>{formatMoney(expense.amount, true)}</strong>
          </button>
          <button className="fixed-expense-action" onClick={() => onEdit(expense)} aria-label={`Edit ${expense.name}`}><Pencil size={15} /></button>
          <button className="fixed-expense-action danger" onClick={() => onDelete(expense)} aria-label={`Delete ${expense.name}`}><Trash2 size={15} /></button>
        </div>
      ))}
      {!expenses.length ? <div className="fixed-expenses-empty">No fixed expenses yet.</div> : null}
      <button className="fixed-expense-add" onClick={onAdd}><Plus size={15} /> Add fixed expense</button>
    </div>
  );
}

function SalaryEditor({ salary, onChange, onDelete }: { salary: SalaryProfile; onChange: (salary: SalaryProfile) => void; onDelete: () => void }) {
  const currentCycle = getFinancialCycle(new Date(), salary.payday);
  const currentMonth = currentCycle.key;
  const monthly = salary.monthlyOvertime?.[currentMonth] ?? { hours: 0 };
  const estimated = monthly.usableOverride ?? monthly.hours * (salary.overtimeGrossRate ?? 0) * salary.overtimeNetRatio;
  const overtimeReserve = overtimeTaxReserve(monthly.hours);
  const setMonthly = (patch: Partial<typeof monthly>) => onChange({ ...salary, monthlyOvertime: { ...(salary.monthlyOvertime ?? {}), [currentMonth]: { ...monthly, ...patch } } });

  return (
    <>
      <div className="settings-card card">
        <label className="setting-row"><SettingCopy title="Profile name" subtitle="Used for your salary settings" /><input value={salary.name} onChange={(event) => onChange({ ...salary, name: event.target.value })} /></label>
        <label className="setting-row"><SettingCopy title="Usable monthly income" subtitle="After deductions" /><NumberInput value={salary.usableMonthlyIncome} onValueChange={(value) => { if (value !== undefined) onChange({ ...salary, usableMonthlyIncome: value }); }} /></label>
        <label className="setting-row"><SettingCopy title="Gross monthly salary" subtitle="Optional reference" /><NumberInput value={salary.grossSalary} allowEmpty placeholder="Optional" onValueChange={(value) => onChange({ ...salary, grossSalary: value })} /></label>
        <label className="setting-row"><SettingCopy title="Payday" subtitle="Starts each financial cycle" /><div className="inline-unit"><NumberInput min="1" max="31" value={salary.payday} onValueChange={(value) => { if (value !== undefined) onChange({ ...salary, payday: value }); }} /><span>of month</span></div></label>
        <label className="setting-row"><SettingCopy title="Overtime gross rate" subtitle="Per hour" /><NumberInput step="0.01" value={salary.overtimeGrossRate} allowEmpty onValueChange={(value) => onChange({ ...salary, overtimeGrossRate: value })} /></label>
        <label className="setting-row"><SettingCopy title="Estimated usable ratio" subtitle="Gross overtime converted to usable" /><div className="inline-unit"><NumberInput min="0" max="100" step="1" value={Math.round(salary.overtimeNetRatio * 100)} onValueChange={(value) => { if (value !== undefined) onChange({ ...salary, overtimeNetRatio: value / 100 }); }} /><span>%</span></div></label>
        <label className="setting-row"><SettingCopy title="Realistic overtime" subtitle="Average monthly hours" /><div className="inline-unit"><NumberInput value={salary.averageOvertimeHours} onValueChange={(value) => { if (value !== undefined) onChange({ ...salary, averageOvertimeHours: value }); }} /><span>hours</span></div></label>
        <label className="setting-row"><SettingCopy title="13th salary months" subtitle="Comma-separated month numbers" /><input inputMode="numeric" value={salary.thirteenthSalaryMonths.join(", ")} onChange={(event) => onChange({ ...salary, thirteenthSalaryMonths: event.target.value.split(",").map(Number).filter((value) => value >= 1 && value <= 12) })} placeholder="6, 12" /></label>
      </div>
      <div className="overtime-card monthly-overtime">
        <div><span>{currentCycle.label} overtime</span><strong>{monthly.hours} hours</strong><small>{formatMoney(salary.overtimeGrossRate ?? 0)} gross/hour</small></div>
        <div className="monthly-overtime-controls">
          <label><span>Hours</span><NumberInput min="0" value={monthly.hours} onValueChange={(value) => { if (value !== undefined) setMonthly({ hours: value }); }} /></label>
          <label><span>Usable override</span><NumberInput min="0" value={monthly.usableOverride} allowEmpty onValueChange={(value) => setMonthly({ usableOverride: value })} placeholder={formatMoney(estimated)} /></label>
          <small>Estimated usable: <strong>{formatMoney(estimated)}</strong> · Rough tax reference only: <strong>{formatMoney(overtimeReserve)}</strong> (~€{OVERTIME_TAX_RESERVE_PER_HOUR}/hour, not added)</small>
        </div>
      </div>
      <button className="delete-profile" onClick={onDelete}><Trash2 size={14} /> Delete salary profile</button>
    </>
  );
}
