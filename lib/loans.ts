import type { FlowData, PersonalLoan, LoanPlanMovement, Transaction } from "./types";
import { applyTransactionToFunds } from "./fund-mutations";

const cents = (n: number) => Math.round(n * 100);
const today = () => new Date().toLocaleDateString("sv-SE");
export function initialLoans(data: FlowData): PersonalLoan[] {
  return data.loans ?? [{ id: "mamma-project-draft", title: "Anticipo progetto mamma", person: "Mamma", type: "given", currency: "EUR", notes: "Rimborso collegato all’incasso del progetto. Bozza: confermare inizio, conto e piano. Nessun rimborso certo.", startDate: "2026-11-01", startConfirmed: false, cap: 4000, monthlyAdvance: 500, repaymentFrom: "2027-05-01", repaymentTo: "2027-06-30", fundId: data.funds.find(f => f.kind === "savings")?.id ?? data.funds[0]?.id ?? "", suspended: false, archived: false, plan: [] }];
}
export function loanTotals(data: FlowData, id: string) {
  const movements = data.transactions.filter(t => t.loan?.id === id);
  const advanced = movements.filter(t => t.loan?.kind === "advance").reduce((s,t) => s + cents(t.amount), 0);
  const repaid = movements.filter(t => t.loan?.kind === "repayment").reduce((s,t) => s + cents(t.amount), 0);
  return { advanced: advanced / 100, repaid: repaid / 100, residual: (advanced - repaid) / 100, movements };
}
export function loanStatus(data: FlowData, loan: PersonalLoan) {
  const totals = loanTotals(data, loan.id);
  return loan.archived ? "archiviato" : !totals.advanced ? "pianificato" : totals.residual === 0 ? "saldato" : "attivo";
}
export function saveLoan(data: FlowData, loan: PersonalLoan): FlowData {
  if (!loan.title.trim() || !loan.person.trim() || !data.funds.some(f => f.id === loan.fundId)) throw new Error("Indica titolo, persona e conto validi.");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(loan.startDate)) throw new Error("Indica una data di inizio valida.");
  if (loan.advanceEnd && loan.advanceEnd < loan.startDate) throw new Error("La fine degli anticipi precede l’inizio.");
  if (loan.plan.some(p => !Number.isFinite(p.amount) || cents(p.amount) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(p.date))) throw new Error("Controlla date e importi del piano.");
  if (loan.monthlyAdvance && (!Number.isFinite(loan.monthlyAdvance) || loan.monthlyAdvance < 0)) throw new Error("Importo non valido.");
  if (loan.cap !== undefined && (!Number.isFinite(loan.cap) || loan.cap <= 0)) throw new Error("Tetto non valido.");
  if (loan.repaymentFrom && loan.repaymentTo && loan.repaymentFrom > loan.repaymentTo) throw new Error("Finestra di rimborso non valida.");
  const previous = data.loans?.find(l => l.id === loan.id);
  if (previous && previous.type !== loan.type && loanTotals(data, loan.id).movements.length) throw new Error("Non puoi cambiare tipo dopo aver registrato movimenti.");
  const loans = data.loans ?? [];
  return { ...data, loans: loans.some(l => l.id === loan.id) ? loans.map(l => l.id === loan.id ? structuredClone(loan) : l) : [...loans, structuredClone(loan)] };
}
export function cashDirection(loan: PersonalLoan, kind: LoanPlanMovement["kind"]): 1 | -1 {
  return (loan.type === "given") === (kind === "advance") ? -1 : 1;
}
export function postLoanMovement(data: FlowData, id: string, movement: LoanPlanMovement, existingId?: string): FlowData {
  const loan = data.loans?.find(l => l.id === id);
  if (!loan) throw new Error("Prestito non trovato.");
  const existing = existingId ? data.transactions.find(t => t.id === existingId) : undefined;
  if (existingId && !existing) throw new Error("Transazione non trovata.");
  if (existing?.loan || existing?.recurrence || existing?.recurringBudgetId || existing?.paymentMethod === "amex" || existing?.type === "transfer") throw new Error("Transazione già associata o non compatibile.");
  const amount = existing?.amount ?? movement.amount;
  const date = existing?.date ?? movement.date;
  if (!Number.isFinite(amount) || cents(amount) <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > today()) throw new Error("Usa un importo positivo e una data effettiva non futura.");
  if (data.transactions.some(t => t.loan?.id === id && t.loan.planId === movement.id)) throw new Error("Movimento già registrato.");
  const direction = cashDirection(loan, movement.kind);
  if (existing && (existing.type === "income" ? 1 : -1) !== direction) throw new Error("Il verso della transazione non corrisponde al movimento.");
  const totals = loanTotals(data, id);
  if (movement.kind === "repayment" && cents(amount) > cents(totals.residual)) throw new Error("Il rimborso supera il capitale residuo.");
  const transaction: Transaction = { ...(existing ?? {}), id: existing?.id ?? crypto.randomUUID(), name: `${loan.title} · ${movement.kind === "advance" ? "Anticipo" : "Rimborso"}`, type: "transfer", amount: cents(amount) / 100, date, fundId: existing?.fundId ?? loan.fundId, fundAccountId: existing?.fundAccountId ?? loan.fundAccountId, notes: movement.notes, loan: { id, kind: movement.kind, direction, planId: movement.id }, createdAt: existing?.createdAt ?? new Date().toISOString() };
  if (!data.funds.some(f => f.id === transaction.fundId && (!transaction.fundAccountId || f.accounts?.some(a => a.id === transaction.fundAccountId)))) throw new Error("Seleziona un conto esistente.");
  return { ...data, funds: existing ? data.funds : applyTransactionToFunds(data.funds, transaction, 1), transactions: existing ? data.transactions.map(t => t.id === existing.id ? transaction : t) : [transaction, ...data.transactions] };
}
export function removeLoanMovement(data: FlowData, transactionId: string, editing = false): FlowData {
  const t = data.transactions.find(t => t.id === transactionId && t.loan);
  if (!t) return data;
  if (!editing && t.loan?.kind === "advance" && cents(loanTotals(data, t.loan.id).residual) < cents(t.amount)) throw new Error("Rimuovi o correggi prima i rimborsi collegati: supererebbero il capitale erogato.");
  return { ...data, funds: applyTransactionToFunds(data.funds, t, -1), transactions: data.transactions.filter(t => t.id !== transactionId) };
}
export function loanSchedule(data: FlowData, loan: PersonalLoan, end = "2035-12-31"): LoanPlanMovement[] {
  if (loan.archived) return [];
  const posted = new Set(data.transactions.filter(t => t.loan?.id === loan.id).map(t => t.loan?.planId));
  const plan = loan.plan.filter(p => !posted.has(p.id) && !(loan.suspended && p.kind === "advance"));
  if (!loan.suspended && loan.startConfirmed && loan.monthlyAdvance && loan.monthlyAdvance > 0) {
    let allocated = cents(loanTotals(data, loan.id).advanced) + plan.filter(p => p.kind === "advance").reduce((s,p) => s + cents(p.amount), 0);
    for (let i = 0; i < 120; i++) {
      const start = new Date(`${loan.startDate}T12:00:00`);
      const d = new Date(start.getFullYear(), start.getMonth() + i, 1, 12);
      d.setDate(Math.min(start.getDate(), new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      const date = d.toLocaleDateString("sv-SE");
      if (date > end || (loan.advanceEnd && date > loan.advanceEnd)) break;
      const id = `${loan.id}:monthly:${date}`;
      if (posted.has(id)) continue;
      const amount = Math.min(cents(loan.monthlyAdvance), loan.cap === undefined ? Infinity : cents(loan.cap) - allocated);
      if (amount <= 0) break;
      allocated += amount;
      plan.push({ id, date, kind: "advance", amount: amount / 100, notes: "Piano mensile stimato" });
    }
  }
  return plan.sort((a,b) => a.date.localeCompare(b.date));
}
export function loanForecast(data: FlowData, delay = 0) {
  return (data.loans ?? []).flatMap(loan => loanSchedule(data, loan).map(p => {
    const date = new Date(`${p.date}T12:00:00`);
    if (p.kind === "repayment" && delay) { const day = date.getDate(); date.setDate(1); date.setMonth(date.getMonth() + delay); date.setDate(Math.min(day, new Date(date.getFullYear(), date.getMonth()+1,0).getDate())); }
    return { ...p, date: date.toLocaleDateString("sv-SE"), loanId: loan.id, title: loan.title, fundId: loan.fundId, delta: p.amount * cashDirection(loan, p.kind) };
  }));
}

export function editLoanMovement(data: FlowData, transactionId: string, movement: LoanPlanMovement): FlowData {
  const previous = data.transactions.find(t => t.id === transactionId && t.loan);
  if (!previous?.loan) throw new Error("Movimento non trovato.");
  const reversed = removeLoanMovement(data, transactionId, true);
  const updated = postLoanMovement(reversed, previous.loan.id, { ...movement, id: previous.loan.planId ?? movement.id });
  const generated = updated.transactions[0];
  const nextTransaction = { ...generated, id: previous.id, fundId: previous.fundId, fundAccountId: previous.fundAccountId, createdAt: previous.createdAt };
  const funds = applyTransactionToFunds(applyTransactionToFunds(updated.funds, generated, -1), nextTransaction, 1);
  const next = { ...updated, funds, transactions: updated.transactions.map(t => t.id === generated.id ? nextTransaction : t) };
  if (loanTotals(next, previous.loan.id).residual < 0) throw new Error("La modifica renderebbe i rimborsi superiori agli anticipi.");
  return next;
}
