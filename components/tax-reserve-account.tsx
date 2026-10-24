"use client";

import { useState } from "react";
import Link from "next/link";
import { useFlow } from "./app-provider";
import { NumberInput } from "./number-input";
import { formatMoney } from "@/lib/format";
import { loanSchedule } from "@/lib/loans";
import { configureReserveAccount as validateConfiguration, monthlyReserveUpdate, reserveAccountTotals, saveReserveAccount as validateSnapshot, updateReservePreferences as validatePreferences } from "@/lib/tax-reserve";
import type { FundAccount } from "@/lib/types";

export function TaxReserveAccount({ fundId, account, editable }: { fundId: string; account: FundAccount; editable: boolean }) {
  const { data, hydrated, configureReserveAccount, saveReserveAccount, updateReservePreferences } = useFlow();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [theoretical, setTheoretical] = useState(0);
  const [principal, setPrincipal] = useState(0);
  const [recordMonth, setRecordMonth] = useState<string>();
  const [showPreferences, setShowPreferences] = useState(false);
  const [contribution, setContribution] = useState(850);
  const [monthlyLoan, setMonthlyLoan] = useState(500);
  const [endMonth, setEndMonth] = useState("");
  const suggestedLoan = data.loans?.find(l => l.id === "mamma-project-draft" && l.type === "given" && !l.archived)
    ?? data.loans?.find(l => /mamma|madre/i.test(`${l.person} ${l.title}`) && l.type === "given" && !l.archived);
  const [selectedLoan, setSelectedLoan] = useState(suggestedLoan?.id ?? "new");
  const selectedLoanId = data.loans?.some(l => l.id === selectedLoan) ? selectedLoan : "new";
  const tracking = account.taxReserveTracking;
  const totals = reserveAccountTotals(data, account);
  const monthly = tracking && totals.loan ? monthlyReserveUpdate(data, account) : undefined;
  const isTrade = /trade/i.test(account.name);

  function startEditing(month = false) {
    setTheoretical(month && monthly ? monthly.theoretical : totals.theoretical);
    setPrincipal(month && monthly ? monthly.principal : totals.principal);
    setRecordMonth(month ? monthly?.month : undefined);
    setError(""); setNotice(""); setEditing(true);
  }
  if (!tracking) {
    if (!editable) return null;
    return <details className="tax-account-tracking" open={isTrade}>
      <summary>Riserva teorica, prestito e saldo reale</summary>
      <p>Accantonamento mensile: 850 €. Di questi, 500 € a mamma e 350 € su {account.name}, fino a circa maggio. Attiva il riepilogo per gestire separatamente i tre importi.</p>
      <label>Prestito da collegare<select value={selectedLoanId} onChange={e => setSelectedLoan(e.target.value)}>
        <option value="new">Crea prestito mamma</option>
        {(data.loans ?? []).filter(l => l.type === "given" && !l.archived).map(l => <option key={l.id} value={l.id}>{l.title} · {l.person}</option>)}
      </select></label>
      <button className="secondary-button" type="button" disabled={!hydrated} onClick={() => {
        try { validateConfiguration(data, fundId, account.id, selectedLoanId === "new" ? undefined : selectedLoanId); configureReserveAccount(fundId, account.id, selectedLoanId === "new" ? undefined : selectedLoanId); setError(""); }
        catch (err) { setError((err as Error).message); }
      }}>Attiva riepilogo</button>
      <small>L’attivazione conserva il saldo attuale e non registra anticipi o accantonamenti.</small>
      {error && <p role="alert">{error}</p>}
    </details>;
  }
  return <section className="tax-account-tracking" aria-label={`Riserva e prestito ${account.name}`}>
    <h3>{account.name} · riserva e prestito</h3>
    <div className="tax-reserve-metrics">
      <div><small>Riserva teorica</small><strong>{formatMoney(totals.theoretical)}</strong></div>
      <div><small>Prestito da recuperare</small><strong>{formatMoney(totals.principal)}</strong></div>
      <div className="actual"><small>Disponibilità reale</small><strong>{formatMoney(totals.actual)}</strong></div>
    </div>
    <p>Teorico − prestito = denaro realmente disponibile per le tasse.</p>
    {totals.loan ? <p><Link href={`/loans?loan=${totals.loan.id}`}>{totals.loan.title}</Link> · Rientro stimato: {totals.loan.repaymentFrom ?? "da definire"} – {totals.loan.repaymentTo ?? "da definire"}.<small>La finestra è indicativa: nessun rimborso viene registrato automaticamente.</small></p> : <p role="alert">Il prestito collegato non è disponibile. Ripristinalo dal backup prima di aggiornare gli importi.</p>}
    {totals.loan && loanSchedule(data,totals.loan).some(p => p.kind === "repayment") && <p>Tranche previste: {loanSchedule(data,totals.loan).filter(p => p.kind === "repayment").map(p => `${p.date}: ${formatMoney(p.amount)}`).join(" · ")}</p>}
    {editable && !editing && <div className="tax-tracking-actions">
      <button className="secondary-button" type="button" disabled={!totals.loan} onClick={() => startEditing()}>Modifica totali</button>
      <button className="secondary-button" type="button" disabled={!monthly || monthly.alreadyRecorded} onClick={() => startEditing(true)}>{monthly?.alreadyRecorded ? `${monthly.month} già aggiornato` : `Prepara ${monthly?.month ?? "mese"}: +${formatMoney(tracking.monthlyContribution, true)}`}</button>
      <button className="text-button" type="button" onClick={() => { setContribution(tracking.monthlyContribution); setMonthlyLoan(tracking.monthlyLoan); setEndMonth(tracking.endMonth); setShowPreferences(!showPreferences); setError(""); }}>Piano mensile</button>
    </div>}
    {editable && !editing && <small>Se hai già aggiunto l’accantonamento del mese, usa “Modifica totali”. Il saldo sopra, nei conti, ora mostra solo la disponibilità reale.</small>}
    {editable && editing && <form className="tax-tracking-form" onSubmit={event => {
      event.preventDefault();
      try {
        const snapshot = { theoretical, principal, recordMonth };
        validateSnapshot(data, fundId, account.id, snapshot);
        saveReserveAccount(fundId, account.id, snapshot);
        setEditing(false); setError(""); setNotice("Totali aggiornati. Il prestito è sincronizzato senza duplicati.");
      } catch (err) { setError((err as Error).message); }
    }}>
      <label>Riserva teorica totale (€)<NumberInput required min="0" step="0.01" value={theoretical} onValueChange={v => setTheoretical(v ?? 0)} /></label>
      <label>Prestito mamma: residuo totale (€)<NumberInput required min="0" step="0.01" value={principal} onValueChange={v => setPrincipal(v ?? 0)} /></label>
      <div className="tax-real-preview"><small>Disponibilità reale dopo il salvataggio</small><strong>{formatMoney(theoretical - principal)}</strong><small>Variazione su {account.name}: {formatMoney(Math.round((theoretical - principal - totals.actual) * 100) / 100)}</small></div>
      <p>{recordMonth ? `Aggiornamento del mese ${recordMonth}.` : "Inserisci i totali cumulativi, non soltanto l’importo di questo mese."} Aumentare il prestito registra un anticipo; diminuirlo registra un rimborso effettivo. Conferma soltanto importi già avvenuti. Per correggere un movimento errato, modificalo dalla sezione Prestiti.</p>
      <div className="tax-tracking-actions"><button className="primary-button" type="submit">Conferma importi effettivi</button><button className="secondary-button" type="button" onClick={() => { setEditing(false); setError(""); }}>Annulla</button></div>
    </form>}
    {editable && showPreferences && !editing && <form className="tax-tracking-form" onSubmit={event => {
      event.preventDefault();
      try {
        const preferences = { monthlyContribution: contribution, monthlyLoan, endMonth };
        validatePreferences(data, fundId, account.id, preferences); updateReservePreferences(fundId, account.id, preferences);
        setShowPreferences(false); setError(""); setNotice("Piano mensile aggiornato: nessun movimento registrato.");
      } catch (err) { setError((err as Error).message); }
    }}>
      <label>Accantonamento mensile (€)<NumberInput required min="0" step="0.01" value={contribution} onValueChange={v => setContribution(v ?? 0)} /></label>
      <label>Di cui prestito (€)<NumberInput required min="0" step="0.01" value={monthlyLoan} onValueChange={v => setMonthlyLoan(v ?? 0)} /></label>
      <label>Prestito mensile fino a (indicativo)<input required type="month" value={endMonth} onChange={e => setEndMonth(e.target.value)} /></label>
      <p>{formatMoney(contribution)} = {formatMoney(monthlyLoan)} di prestito + {formatMoney(contribution - monthlyLoan)} realmente accantonati. Nessuna operazione automatica.</p>
      <div className="tax-tracking-actions"><button className="primary-button" type="submit">Salva piano</button><button className="secondary-button" type="button" onClick={() => setShowPreferences(false)}>Annulla</button></div>
    </form>}
    {notice && <p role="status">{notice}</p>}{error && <p role="alert">{error}</p>}
  </section>;
}
