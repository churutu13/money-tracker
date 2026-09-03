"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Banknote, CalendarDays, ChevronRight, CircleGauge, Copy, House, Landmark, Pencil, PiggyBank, Plus, ShieldCheck, Sparkles, Trash2, TrendingUp, WalletCards, X } from "lucide-react";
import { NumberInput } from "@/components/number-input";
import { PageHeader } from "@/components/page-header";
import { ProjectionChart } from "@/components/planning/projection-chart";
import { useConfirm } from "@/components/confirm-provider";
import { useFlow } from "@/components/app-provider";
import { formatMoney } from "@/lib/format";
import { cloneScenario, createInitialPlanningWorkspace, createWorkbookScenario } from "@/lib/planning/assumptions";
import { monthLabel } from "@/lib/planning/dates";
import { applyFlowActuals, planningActualsFromFlow } from "@/lib/planning/flow-adapter";
import { compareProjectionResults, runProjection } from "@/lib/planning/projection-engine";
import { workbookValidationSummary } from "@/lib/planning/validation";
import type { AssumptionStatus, FinancialAssumption, FinancialPlanWorkspace, FinancialScenario, ProjectionMonth } from "@/lib/planning/types";

const STORAGE_KEY = "flow.planning.v1";
const statusCopy: Record<AssumptionStatus, string> = { estimated: "Estimated", confirmed: "Confirmed", actual: "Actual" };

export default function PlanPage() {
  const { data, hydrated } = useFlow();
  const confirm = useConfirm();
  const [workspace, setWorkspace] = useState<FinancialPlanWorkspace>(() => createInitialPlanningWorkspace());
  const [planningHydrated, setPlanningHydrated] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("2031-12");
  const [detailMonth, setDetailMonth] = useState<ProjectionMonth | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as FinancialPlanWorkspace;
        if (parsed.version === 1 && parsed.scenarios?.length) setWorkspace(parsed);
      }
    } finally {
      setPlanningHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (planningHydrated) localStorage.setItem(STORAGE_KEY, JSON.stringify(workspace));
  }, [planningHydrated, workspace]);

  const storedActive = workspace.scenarios.find((scenario) => scenario.id === workspace.activeScenarioId) ?? workspace.scenarios[0];
  const actuals = useMemo(() => planningActualsFromFlow(data), [data]);
  const active = useMemo(() => workspace.useFlowActuals ? applyFlowActuals(storedActive, data) : storedActive, [data, storedActive, workspace.useFlowActuals]);
  const result = useMemo(() => runProjection(active), [active]);
  const compareStored = workspace.scenarios.find((scenario) => scenario.id === workspace.compareScenarioId && scenario.id !== storedActive.id);
  const compareScenario = useMemo(() => compareStored ? (workspace.useFlowActuals ? applyFlowActuals(compareStored, data) : compareStored) : undefined, [compareStored, data, workspace.useFlowActuals]);
  const compareResult = useMemo(() => compareScenario ? runProjection(compareScenario) : undefined, [compareScenario]);
  const comparison = compareResult ? compareProjectionResults(result, compareResult) : undefined;
  const validation = useMemo(() => workbookValidationSummary(), []);
  const selected = result.months.find((item) => item.month === selectedMonth) ?? result.finalMonth;
  const monthlyCapacity = result.finalMonth.totalIncome - result.finalMonth.totalOutflow;

  function updateActive(change: (scenario: FinancialScenario) => void) {
    setWorkspace((current) => ({
      ...current,
      scenarios: current.scenarios.map((scenario) => {
        if (scenario.id !== current.activeScenarioId) return scenario;
        const next = structuredClone(scenario);
        change(next);
        next.updatedAt = new Date().toISOString();
        return next;
      }),
    }));
  }

  function duplicateScenario() {
    const id = crypto.randomUUID();
    const next = cloneScenario(storedActive, id, `${storedActive.name} copy`);
    setWorkspace((current) => ({ ...current, activeScenarioId: id, scenarios: [...current.scenarios, next] }));
  }

  function newScenario() {
    const id = crypto.randomUUID();
    const next = createWorkbookScenario(id, `Scenario ${workspace.scenarios.length + 1}`);
    setWorkspace((current) => ({ ...current, activeScenarioId: id, scenarios: [...current.scenarios, next] }));
  }

  async function deleteScenario() {
    if (workspace.scenarios.length === 1) return;
    const approved = await confirm({ title: "Delete this scenario?", message: `${storedActive.name} and its assumptions will be removed.`, confirmLabel: "Delete", danger: true });
    if (!approved) return;
    setWorkspace((current) => {
      const remaining = current.scenarios.filter((scenario) => scenario.id !== current.activeScenarioId);
      return { ...current, activeScenarioId: remaining[0].id, compareScenarioId: current.compareScenarioId === current.activeScenarioId ? undefined : current.compareScenarioId, scenarios: remaining };
    });
  }

  if (!hydrated || !planningHydrated) return <div className="content-wrap plan-page"><PageHeader eyebrow="Future planning" title="Plan" subtitle="Loading your projection…" /></div>;

  return <div className="content-wrap plan-page">
    <PageHeader eyebrow="Future planning" title="Plan" subtitle="See what a decision does to your money before you make it." action={<span className={`plan-model-status ${validation.failed ? "warning" : ""}`}><ShieldCheck size={14} /> {validation.failed ? `${validation.failed} model checks` : `${validation.passed} model checks passed`}</span>} />

    <section className="plan-scenario-bar" aria-label="Saved scenarios">
      <div className="plan-scenario-tabs">
        {workspace.scenarios.map((scenario) => <button key={scenario.id} className={scenario.id === storedActive.id ? "active" : ""} onClick={() => setWorkspace((current) => ({ ...current, activeScenarioId: scenario.id }))}>{scenario.name}</button>)}
      </div>
      <button className="plan-icon-action" onClick={newScenario} aria-label="New scenario"><Plus size={17} /></button>
      <button className="plan-icon-action" onClick={duplicateScenario} aria-label="Duplicate scenario"><Copy size={16} /></button>
    </section>

    <section className="plan-hero card">
      <div className="plan-hero-main">
        <span>Projected available liquidity</span>
        <strong>{formatMoney(result.finalMonth.closingAvailableLiquidity, true)}</strong>
        <p>{monthLabel(result.finalMonth.month, { month: "long", year: "numeric" })} · {storedActive.name}</p>
      </div>
      <div className="plan-hero-networth"><span>Projected net worth</span><strong>{formatMoney(result.finalMonth.netWorth, true)}</strong><small>Cash, investments and home equity</small></div>
    </section>

    <section className="plan-toggle-grid" aria-label="Quick scenarios">
      <ScenarioToggle label="Senior" detail={`+${formatMoney(active.senior.monthlyIncrease.value, true)}/mo`} enabled={storedActive.senior.enabled} onChange={(enabled) => updateActive((scenario) => { scenario.senior.enabled = enabled; })} icon={<Sparkles size={17} />} />
      <ScenarioToggle label="Living together" detail={`${formatMoney(active.livingTogether.monthlyCost.value, true)}/mo`} enabled={storedActive.livingTogether.enabled} onChange={(enabled) => updateActive((scenario) => { scenario.livingTogether.enabled = enabled; })} icon={<House size={17} />} />
      <ScenarioToggle label="Buy house" detail={active.housing.enabled ? `${Math.round(active.housing.mortgage.ltv.value * 100)}% LTV` : "Jan 2029"} enabled={storedActive.housing.enabled} onChange={(enabled) => updateActive((scenario) => { scenario.housing.enabled = enabled; })} icon={<Landmark size={17} />} />
      <ScenarioToggle label="Tesla repayment" detail={formatMoney(active.teslaPartialRepayment.amount.value, true)} enabled={storedActive.teslaPartialRepayment.enabled} onChange={(enabled) => updateActive((scenario) => { scenario.teslaPartialRepayment.enabled = enabled; })} icon={<ArrowDownRight size={17} />} />
      <ScenarioToggle label="Investments" detail={storedActive.investments.enabled ? `${(active.investments.annualReturn.value * 100).toFixed(1)}% assumed` : "0% baseline"} enabled={storedActive.investments.enabled} onChange={(enabled) => updateActive((scenario) => { scenario.investments.enabled = enabled; })} icon={<TrendingUp size={17} />} />
    </section>

    <section className="plan-kpi-grid">
      <Metric icon={<WalletCards />} label="Current savings" value={formatMoney(actuals.availableLiquidity, true)} detail="From Flow savings funds" />
      <Metric icon={<ArrowUpRight />} label="Monthly capacity" value={formatMoney(monthlyCapacity, true)} detail="At the end of this plan" />
      <Metric icon={<CircleGauge />} label="Lowest cash point" value={formatMoney(result.minimumAvailableLiquidity, true)} detail={monthLabel(result.minimumLiquidityMonth)} tone={result.minimumAvailableLiquidity < active.warningLiquidityBuffer.value ? "danger" : result.minimumAvailableLiquidity < active.minimumLiquidityBuffer.value ? "warning" : "positive"} />
      <Metric icon={<PiggyBank />} label="Safe to invest" value={formatMoney(result.safeToInvest, true)} detail={`Keeps ${formatMoney(active.minimumLiquidityBuffer.value, true)} in cash`} tone={result.safeToInvest > 0 ? "positive" : undefined} />
    </section>

    <ProjectionChart months={result.months} selectedMonth={selected.month} onSelectMonth={(item) => setSelectedMonth(item.month)} onInspectMonth={setDetailMonth} />

    <section className="plan-two-column">
      <article className="plan-yearly card">
        <header><div><span className="section-label">Yearly view</span><h2>Liquidity path</h2></div><select value={compareStored?.id ?? ""} onChange={(event) => setWorkspace((current) => ({ ...current, compareScenarioId: event.target.value || undefined }))}><option value="">No comparison</option>{workspace.scenarios.filter((scenario) => scenario.id !== storedActive.id).map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.name}</option>)}</select></header>
        <div className="plan-year-list">
          {result.yearly.map((year) => {
            const peer = compareResult?.yearly.find((item) => item.year === year.year);
            return <div key={year.year}><span>{year.year}</span><strong>{formatMoney(year.liquidity, true)}</strong>{peer ? <small className={peer.liquidity - year.liquidity >= 0 ? "positive-text" : "negative-text"}>{peer.liquidity - year.liquidity >= 0 ? "+" : ""}{formatMoney(peer.liquidity - year.liquidity, true)}</small> : <small>—</small>}</div>;
          })}
        </div>
        {comparison ? <footer><span>{comparison.comparisonName} in 2031</span><strong className={comparison.finalLiquidityDelta >= 0 ? "positive-text" : "negative-text"}>{comparison.finalLiquidityDelta >= 0 ? "+" : ""}{formatMoney(comparison.finalLiquidityDelta, true)}</strong></footer> : null}
      </article>

      <article className="plan-safe card">
        <span className="section-label">Safe to invest</span>
        <h2>{formatMoney(result.safeToInvest, true)}</h2>
        <p>You can move this amount today while keeping at least {formatMoney(active.minimumLiquidityBuffer.value, true)} of projected cash through {monthLabel(active.endMonth)}.</p>
        <div className="plan-keep-cash"><ShieldCheck size={17} /><span><small>Keep in cash</small><strong>{formatMoney(active.openingAvailableLiquidity.value - result.safeToInvest, true)}</strong></span></div>
        <div className="plan-obligations">
          {result.events.filter((item) => item.liquidityImpact < 0).slice(0, 4).map((item) => <div key={`${item.id}-${item.month}`}><CalendarDays size={14} /><span><strong>{item.title}</strong><small>{monthLabel(item.month)}</small></span><b>{formatMoney(item.liquidityImpact, true)}</b></div>)}
        </div>
      </article>
    </section>

    {comparison && compareResult ? <section className="plan-comparison card">
      <header><div><span className="section-label">Scenario comparison</span><h2>{comparison.baseName} <ArrowRightIcon /> {comparison.comparisonName}</h2></div><strong className={comparison.finalLiquidityDelta >= 0 ? "positive-text" : "negative-text"}>{comparison.finalLiquidityDelta >= 0 ? "+" : ""}{formatMoney(comparison.finalLiquidityDelta, true)} final cash</strong></header>
      <div>
        <ComparisonMetric label="Upfront cash" value={(compareResult.house?.totalUpfrontCashRequired ?? 0) - (result.house?.totalUpfrontCashRequired ?? 0)} />
        <ComparisonMetric label="Monthly expenses" value={(compareResult.finalMonth.totalOutflow - compareResult.finalMonth.investmentContribution) - (result.finalMonth.totalOutflow - result.finalMonth.investmentContribution)} inverse />
        <ComparisonMetric label="Lowest liquidity" value={comparison.minimumLiquidityDelta} />
        <ComparisonMetric label="2031 net worth" value={comparison.finalNetWorthDelta} />
        <ComparisonMetric label="Home equity" value={comparison.homeEquityDelta} />
        <ComparisonMetric label="Monthly saving" value={comparison.monthlySavingsCapacityDelta} />
      </div>
    </section> : null}

    <HouseSimulator scenario={active} storedScenario={storedActive} result={result} update={updateActive} />

    <section className="plan-two-column plan-lower">
      <article className="plan-timeline card">
        <header><span className="section-label">Financial timeline</span><h2>What changes, when</h2></header>
        <div>{result.events.map((item) => <button key={`${item.id}-${item.month}`} onClick={() => { const found = result.months.find((monthItem) => monthItem.month === item.month); if (found) { setSelectedMonth(found.month); setDetailMonth(found); } }}><span className={`plan-event-icon ${item.kind}`}><CalendarDays size={15} /></span><span><strong>{item.title}</strong><small>{monthLabel(item.month)} · {item.detail}</small></span><b>{item.liquidityImpact ? formatMoney(item.liquidityImpact, true) : item.futureMonthlyImpact ? `${item.futureMonthlyImpact > 0 ? "+" : ""}${formatMoney(item.futureMonthlyImpact, true)}/mo` : ""}</b><ChevronRight size={15} /></button>)}</div>
      </article>

      <ScenarioManager workspace={workspace} active={storedActive} updateWorkspace={setWorkspace} updateActive={updateActive} deleteScenario={deleteScenario} />
    </section>

    <AssumptionsEditor scenario={active} useFlowActuals={workspace.useFlowActuals} onToggleActuals={(value) => setWorkspace((current) => ({ ...current, useFlowActuals: value }))} update={updateActive} />

    {detailMonth ? <MonthDetail month={detailMonth} onClose={() => setDetailMonth(null)} /> : null}
  </div>;
}

function ScenarioToggle({ label, detail, enabled, onChange, icon }: { label: string; detail: string; enabled: boolean; onChange: (value: boolean) => void; icon: ReactNode }) {
  return <label className={`plan-toggle card ${enabled ? "enabled" : ""}`}><span className="plan-toggle-icon">{icon}</span><span><strong>{label}</strong><small>{detail}</small></span><input type="checkbox" checked={enabled} onChange={(event) => onChange(event.target.checked)} /></label>;
}

function Metric({ icon, label, value, detail, tone }: { icon: ReactNode; label: string; value: string; detail: string; tone?: "positive" | "warning" | "danger" }) {
  return <article className={`plan-kpi card ${tone ?? ""}`}><span>{icon}</span><div><small>{label}</small><strong>{value}</strong><p>{detail}</p></div></article>;
}

function HouseSimulator({ scenario, storedScenario, result, update }: { scenario: FinancialScenario; storedScenario: FinancialScenario; result: ReturnType<typeof runProjection>; update: (change: (scenario: FinancialScenario) => void) => void }) {
  const house = result.house;
  const setBuying = (buying: "alone" | "together") => update((next) => {
    next.housing.buying = buying;
    next.housing.purchasePrice.value = buying === "alone" ? 150000 : 200000;
    next.housing.ownershipShare.value = buying === "alone" ? 1 : 0.5;
    next.housing.purchaseCosts.value = buying === "alone" ? 10000 : 12000;
    next.housing.additionalLivingCosts.value = buying === "alone" ? 550 : 300;
  });
  return <details className="plan-house card" open={storedScenario.housing.enabled}>
    <summary><span><Landmark size={19} /><span><strong>House Simulator</strong><small>Down payment, mortgage, cash buffer and home equity</small></span></span><ChevronRight size={18} /></summary>
    <div className="plan-house-body">
      <div className="plan-house-controls">
        <div className="plan-segment"><button className={storedScenario.housing.buying === "alone" ? "active" : ""} onClick={() => setBuying("alone")}>Buying alone</button><button className={storedScenario.housing.buying === "together" ? "active" : ""} onClick={() => setBuying("together")}>Buying together</button></div>
        <PlannerNumber label="Purchase price" value={scenario.housing.purchasePrice.value} suffix="EUR" step={1000} onChange={(value) => update((next) => { next.housing.purchasePrice.value = value; })} />
        <OptionRow label="Mortgage LTV" note={scenario.housing.mortgage.ltv.value === 0.9 ? "Consap-style · hypothetical" : "Standard scenario"} options={[{ label: "80%", value: 0.8 }, { label: "90%", value: 0.9 }]} value={scenario.housing.mortgage.ltv.value} onChange={(value) => update((next) => { next.housing.mortgage.ltv.value = value; })} />
        <OptionRow label="Mortgage term" note="Amortizing mortgage" options={[{ label: "20y", value: 20 }, { label: "25y", value: 25 }, { label: "30y", value: 30 }]} value={scenario.housing.mortgage.termYears.value} onChange={(value) => update((next) => { next.housing.mortgage.termYears.value = value; })} />
        <PlannerNumber label="Interest rate" value={scenario.housing.mortgage.annualInterestRate.value * 100} suffix="%" step={0.1} onChange={(value) => update((next) => { next.housing.mortgage.annualInterestRate.value = value / 100; })} />
        <label className="plan-input-row"><span><strong>Purchase date</strong><small>Modeled at the start of the month</small></span><input type="month" value={scenario.housing.purchaseMonth.value} onChange={(event) => update((next) => { next.housing.purchaseMonth.value = event.target.value; })} /></label>
        {scenario.housing.buying === "together" ? <PlannerNumber label="Your ownership share" value={scenario.housing.ownershipShare.value * 100} suffix="%" step={5} onChange={(value) => update((next) => { next.housing.ownershipShare.value = value / 100; })} /> : null}
        <PlannerNumber label="Estimated purchase costs" value={scenario.housing.purchaseCosts.value} suffix="EUR total" step={500} onChange={(value) => update((next) => { next.housing.purchaseCosts.value = value; })} />
        <PlannerNumber label="Additional living costs" value={scenario.housing.additionalLivingCosts.value} suffix="EUR/mo" step={10} onChange={(value) => update((next) => { next.housing.additionalLivingCosts.value = value; })} />
        <PlannerNumber label="Home appreciation" value={scenario.housing.annualHomeAppreciation.value * 100} suffix="%/year" step={0.1} onChange={(value) => update((next) => { next.housing.annualHomeAppreciation.value = value / 100; })} />
        <p className="plan-caveat">90% LTV is a Consap-style simulation only—subject to eligibility, lender approval, and future availability. Additional living costs should exclude expenses already present in Flow.</p>
      </div>
      {house ? <div className="plan-house-results">
        <div className={`plan-buffer-card ${house.bufferDifference >= 0 ? "comfortable" : house.availableAfterPurchase >= scenario.warningLiquidityBuffer.value ? "warning" : "danger"}`}><span>Cash after purchase</span><strong>{formatMoney(house.availableAfterPurchase, true)}</strong><small>{house.bufferDifference >= 0 ? "Comfortable" : "Below target"} · {house.bufferDifference >= 0 ? "+" : ""}{formatMoney(house.bufferDifference, true)} vs target</small></div>
        <ResultRow label="Mortgage principal" value={formatMoney(house.mortgagePrincipal, true)} />
        <ResultRow label="Your down payment" value={formatMoney(house.userDownPayment, true)} />
        <ResultRow label="Your purchase costs" value={formatMoney(house.userPurchaseCosts, true)} />
        <ResultRow label="Total upfront cash" value={formatMoney(house.totalUpfrontCashRequired, true)} strong />
        <ResultRow label="Liquidity before purchase" value={formatMoney(house.availableBeforePurchase, true)} />
        <ResultRow label="Liquidity after purchase" value={formatMoney(house.availableAfterPurchase, true)} strong />
        <ResultRow label="Total mortgage payment" value={`${formatMoney(house.mortgagePayment, true)}/mo`} />
        <ResultRow label="Your mortgage share" value={`${formatMoney(house.userMortgagePayment, true)}/mo`} />
        <ResultRow label="Tesla payment" value={`${formatMoney(house.teslaPayment, true)}/mo`} />
        <ResultRow label="Total fixed cost after purchase" value={`${formatMoney(house.monthlyFixedCostAfterPurchase, true)}/mo`} strong />
        <div className="plan-house-horizon"><span><small>After 1 year</small><strong>{formatMoney(house.liquidityAfterOneYear, true)}</strong></span><span><small>After 3 years</small><strong>{formatMoney(house.liquidityAfterThreeYears, true)}</strong></span><span><small>After 5 years</small><strong>{house.liquidityAfterFiveYears === null ? "Beyond horizon" : formatMoney(house.liquidityAfterFiveYears, true)}</strong></span></div>
      </div> : <div className="plan-house-empty"><House size={28} /><strong>Turn on Buy house</strong><p>The simulator will calculate upfront cash, mortgage payments, liquidity and home equity.</p><button className="primary-button" onClick={() => update((next) => { next.housing.enabled = true; })}>Enable simulation</button></div>}
    </div>
  </details>;
}

function ScenarioManager({ workspace, active, updateWorkspace, updateActive, deleteScenario }: { workspace: FinancialPlanWorkspace; active: FinancialScenario; updateWorkspace: (value: FinancialPlanWorkspace | ((current: FinancialPlanWorkspace) => FinancialPlanWorkspace)) => void; updateActive: (change: (scenario: FinancialScenario) => void) => void; deleteScenario: () => void }) {
  return <article className="plan-manager card"><header><span className="section-label">Saved scenario</span><h2>Keep this decision</h2></header><label><span><Pencil size={14} /> Name</span><input value={active.name} onChange={(event) => updateActive((scenario) => { scenario.name = event.target.value; })} /></label><div><button className="secondary-button" onClick={() => {
    const id = crypto.randomUUID();
    const copy = cloneScenario(active, id, `${active.name} copy`);
    updateWorkspace((current) => ({ ...current, activeScenarioId: id, scenarios: [...current.scenarios, copy] }));
  }}><Copy size={15} /> Duplicate</button><button className="secondary-button danger-text" disabled={workspace.scenarios.length === 1} onClick={deleteScenario}><Trash2 size={15} /> Delete</button></div><p>Every scenario keeps its own assumptions. Switch between them from the chips at the top.</p></article>;
}

function AssumptionsEditor({ scenario, useFlowActuals, onToggleActuals, update }: { scenario: FinancialScenario; useFlowActuals: boolean; onToggleActuals: (value: boolean) => void; update: (change: (scenario: FinancialScenario) => void) => void }) {
  return <details className="plan-assumptions card">
    <summary><span><Banknote size={19} /><span><strong>Assumptions</strong><small>Edit inputs, sources and scenario timing</small></span></span><ChevronRight size={18} /></summary>
    <div className="plan-assumptions-body">
      <label className="plan-actual-toggle"><span><strong>Use confirmed Flow values</strong><small>Salary and recurring transactions override workbook estimates where Flow has data.</small></span><input type="checkbox" checked={useFlowActuals} onChange={(event) => onToggleActuals(event.target.checked)} /></label>
      <div className="plan-assumption-grid">
        <AssumptionNumber assumption={scenario.openingAvailableLiquidity} onChange={(value) => update((next) => { next.openingAvailableLiquidity.value = value; })} />
        <AssumptionNumber assumption={scenario.openingTaxReserve} disabled={useFlowActuals && scenario.openingTaxReserve.status === "actual"} onChange={(value) => update((next) => { next.openingTaxReserve.value = value; })} />
        <AssumptionNumber assumption={scenario.monthlyNetIncome} disabled={useFlowActuals && scenario.monthlyNetIncome.status === "actual"} onChange={(value) => update((next) => { next.monthlyNetIncome.value = value; })} />
        <AssumptionNumber assumption={scenario.annualExtraIncome} onChange={(value) => update((next) => { next.annualExtraIncome.value = value; })} />
        <AssumptionNumber assumption={scenario.monthlyOvertimeIncome} onChange={(value) => update((next) => { next.monthlyOvertimeIncome.value = value; })} />
        <AssumptionNumber assumption={scenario.taxReserveBeforeTransition} onChange={(value) => update((next) => { next.taxReserveBeforeTransition.value = value; })} />
        <AssumptionNumber assumption={scenario.taxReserveAfterTransition} onChange={(value) => update((next) => { next.taxReserveAfterTransition.value = value; })} />
        <AssumptionNumber assumption={scenario.lifestyleBuffer} onChange={(value) => update((next) => { next.lifestyleBuffer.value = value; })} />
        <AssumptionNumber assumption={scenario.minimumLiquidityBuffer} onChange={(value) => update((next) => { next.minimumLiquidityBuffer.value = value; })} />
        <AssumptionNumber assumption={scenario.senior.monthlyIncrease} onChange={(value) => update((next) => { next.senior.monthlyIncrease.value = value; })} />
        <AssumptionNumber assumption={scenario.livingTogether.monthlyCost} onChange={(value) => update((next) => { next.livingTogether.monthlyCost.value = value; })} />
        <AssumptionNumber assumption={scenario.findomesticPayoff.amount} onChange={(value) => update((next) => { next.findomesticPayoff.amount.value = value; })} />
        <AssumptionNumber assumption={scenario.teslaPartialRepayment.amount} onChange={(value) => update((next) => { next.teslaPartialRepayment.amount.value = value; })} />
        <AssumptionNumber assumption={scenario.teslaPartialRepayment.resultingMonthlyPayment} onChange={(value) => update((next) => { next.teslaPartialRepayment.resultingMonthlyPayment.value = value; })} />
        <AssumptionNumber assumption={scenario.investments.annualReturn} percentage onChange={(value) => update((next) => { next.investments.annualReturn.value = value; })} />
        <AssumptionNumber assumption={scenario.investments.monthlyContribution} onChange={(value) => update((next) => { next.investments.monthlyContribution.value = value; })} />
      </div>
      <div className="plan-date-grid"><PlanDate label="Senior starts" value={scenario.senior.effectiveMonth.value} onChange={(value) => update((next) => { next.senior.effectiveMonth.value = value; })} /><PlanDate label="Living together starts" value={scenario.livingTogether.effectiveMonth.value} onChange={(value) => update((next) => { next.livingTogether.effectiveMonth.value = value; })} /><PlanDate label="Findomestic payoff" value={scenario.findomesticPayoff.month.value} onChange={(value) => update((next) => { next.findomesticPayoff.month.value = value; })} /><PlanDate label="Tesla repayment" value={scenario.teslaPartialRepayment.month.value} onChange={(value) => update((next) => { next.teslaPartialRepayment.month.value = value; })} /></div>
      <div className="plan-expense-editor"><h3>Recurring expenses</h3>{scenario.recurringExpenses.map((item) => <label key={item.id}><span><strong>{item.name}</strong><small><StatusBadge status={item.amount.status} />{item.endMonth ? `Ends ${monthLabel(item.endMonth)}` : "Ongoing"}</small></span><span><NumberInput min="0" step="0.01" value={item.amount.value} disabled={useFlowActuals && item.amount.status === "actual"} onValueChange={(value) => { if (value !== undefined) update((next) => { const target = next.recurringExpenses.find((expense) => expense.id === item.id); if (target) target.amount.value = value; }); }} /><small>EUR/mo</small></span></label>)}</div>
      {useFlowActuals ? <p className="plan-caveat">Fields marked Actual are read from Flow and disabled here. Turn off confirmed Flow values to edit the underlying workbook assumption for this scenario. The €15,500 opening balance remains the workbook’s 31-Dec-2026 projection anchor because today’s savings balance is from a different date.</p> : null}
    </div>
  </details>;
}

function AssumptionNumber({ assumption, onChange, disabled, percentage }: { assumption: FinancialAssumption<number>; onChange: (value: number) => void; disabled?: boolean; percentage?: boolean }) {
  const value = percentage ? assumption.value * 100 : assumption.value;
  return <label className="plan-assumption"><span><strong>{assumption.label}</strong><small><StatusBadge status={assumption.status} />{assumption.source}</small></span><span><NumberInput min="0" step={percentage ? "0.1" : "0.01"} value={value} disabled={disabled} onValueChange={(next) => { if (next !== undefined) onChange(percentage ? next / 100 : next); }} /><small>{percentage ? "%" : assumption.unit.replace("EUR/", "€/")}</small></span>{assumption.note ? <p>{assumption.note}</p> : null}</label>;
}

function StatusBadge({ status }: { status: AssumptionStatus }) { return <b className={`plan-status ${status}`}>{statusCopy[status]}</b>; }

function PlannerNumber({ label, value, suffix, step, onChange }: { label: string; value: number; suffix: string; step: number; onChange: (value: number) => void }) {
  return <label className="plan-input-row"><span><strong>{label}</strong><small>Editable scenario input</small></span><span><NumberInput min="0" step={step} value={value} onValueChange={(next) => { if (next !== undefined) onChange(next); }} /><small>{suffix}</small></span></label>;
}

function OptionRow({ label, note, options, value, onChange }: { label: string; note: string; options: { label: string; value: number }[]; value: number; onChange: (value: number) => void }) {
  return <div className="plan-option-row"><span><strong>{label}</strong><small>{note}</small></span><div>{options.map((option) => <button key={option.value} className={option.value === value ? "active" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}</div></div>;
}

function ArrowRightIcon() { return <span aria-hidden>→</span>; }

function ComparisonMetric({ label, value, inverse }: { label: string; value: number; inverse?: boolean }) {
  const positive = inverse ? value <= 0 : value >= 0;
  return <span><small>{label}</small><strong className={positive ? "positive-text" : "negative-text"}>{value > 0 ? "+" : ""}{formatMoney(value, true)}</strong></span>;
}

function PlanDate({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label><span>{label}</span><input type="month" value={value} onChange={(event) => onChange(event.target.value)} /></label>; }
function ResultRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className={strong ? "strong" : ""}><span>{label}</span><b>{value}</b></div>; }

function MonthDetail({ month, onClose }: { month: ProjectionMonth; onClose: () => void }) {
  const rows = [
    ["Opening balance", month.openingAvailableLiquidity],
    ["Normal income", month.normalIncome],
    ["Senior increase", month.seniorIncome],
    ["13th / extraordinary income", month.extraordinaryIncome],
    ["Overtime and other income", month.overtimeIncome + month.otherIncome],
    ["Recurring expenses", -month.recurringExpenses],
    ["Debt payments", -month.debtPayments],
    ["Tax reserve", -month.taxReserveContribution],
    ["Lifestyle buffer", -month.lifestyleBuffer],
    ["Living together", -month.livingTogetherCost],
    ["Findomestic payoff", -month.findomesticPayoff],
    ["Tesla partial repayment", -month.teslaPartialRepayment],
    ["House purchase cash", -month.housePurchaseCash],
    ["Mortgage and home costs", -(month.mortgagePayment + month.housingLivingCosts)],
    ["Investments", -month.investmentContribution],
  ].filter(([, value]) => value !== 0) as [string, number][];
  return <div className="plan-detail-layer"><button className="sheet-backdrop" onClick={onClose} aria-label="Close month detail" /><section className="plan-detail-sheet" role="dialog" aria-modal="true" aria-labelledby="plan-month-title"><span className="sheet-handle" /><header><div><span>Projection detail</span><h2 id="plan-month-title">{monthLabel(month.month, { month: "long", year: "numeric" })}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={18} /></button></header><div className="plan-detail-rows">{rows.map(([label, value], index) => <div key={label} className={index === 0 ? "opening" : value > 0 ? "income" : "expense"}><span>{label}</span><strong>{value > 0 && index !== 0 ? "+" : ""}{formatMoney(value, true)}</strong></div>)}<div className="closing"><span>Closing available liquidity</span><strong>{formatMoney(month.closingAvailableLiquidity, true)}</strong></div></div>{month.events.length ? <div className="plan-detail-events"><span>Events this month</span>{month.events.map((item) => <p key={item.id}>{item.title} · {item.detail}</p>)}</div> : null}<footer><span>Tax reserve after month</span><strong>{formatMoney(month.closingTaxReserve, true)}</strong><span>Net worth after month</span><strong>{formatMoney(month.netWorth, true)}</strong></footer></section></div>;
}
