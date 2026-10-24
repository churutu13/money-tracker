import { applyFundDelta } from "./fund-mutations";
import { initialLoans, loanSchedule, loanTotals, postLoanMovement, saveLoan } from "./loans";
import type { FlowData, FundAccount, TaxReserveTracking } from "./types";

const cents = (amount: number) => Math.round(amount * 100);
const localDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const validMoney = (amount: number) => Number.isFinite(amount) && amount >= 0 && Number.isSafeInteger(cents(amount)) && Math.abs(amount - cents(amount) / 100) < 0.0000001;

function findAccount(data: FlowData, fundId: string, accountId: string) {
  const fund = data.funds.find(f => f.id === fundId && f.kind === "tax");
  const account = fund?.accounts?.find(a => a.id === accountId);
  if (!fund || !account) throw new Error("Conto Tax Reserve non trovato.");
  return { fund, account };
}
function replaceAccount(data: FlowData, fundId: string, account: FundAccount): FlowData {
  return { ...data, funds: data.funds.map(fund => {
    if (fund.id !== fundId) return fund;
    const accounts = (fund.accounts ?? []).map(a => a.id === account.id ? account : a);
    return { ...fund, accounts, balance: accounts.reduce((sum,a) => sum + cents(a.balance), 0) / 100 };
  }) };
}
export function reserveAccountTotals(data: FlowData, account: FundAccount) {
  const loan = data.loans?.find(l => l.id === account.taxReserveTracking?.loanId && l.type === "given");
  const principal = loan ? loanTotals(data, loan.id).residual : 0;
  return { actual: account.balance, principal, theoretical: (cents(account.balance) + cents(principal)) / 100, loan };
}

// Linking is informational: preserve every existing balance and transaction.
export function configureReserveAccount(data: FlowData, fundId: string, accountId: string, loanId?: string, date = new Date()): FlowData {
  const { account } = findAccount(data, fundId, accountId);
  if (account.taxReserveTracking && (!loanId || account.taxReserveTracking.loanId === loanId)) return data;
  let loan = data.loans?.find(l => l.id === loanId);
  if (loanId && !loan) throw new Error("Prestito non trovato.");
  if (!loan) {
    loan = { ...initialLoans({ ...data, loans: undefined })[0], id: crypto.randomUUID() };
  }
  if (loan.type !== "given" || loan.archived) throw new Error("Scegli un prestito concesso non archiviato.");
  const usedElsewhere = data.funds.some(f => f.accounts?.some(a => a.taxReserveTracking?.loanId === loan!.id && (f.id !== fundId || a.id !== accountId)));
  if (usedElsewhere) throw new Error("Questo prestito è già collegato a un altro conto.");
  const startMonth = localDate(date).slice(0,7);
  const endYear = date.getMonth() <= 4 ? date.getFullYear() : date.getFullYear() + 1;
  const endMonth = `${endYear}-05`;
  const untouchedDraft = !loan.startConfirmed && loanTotals(data, loan.id).advanced === 0;
  const nextLoan = {
    ...loan, fundId, fundAccountId: accountId, linkedFundId: fundId,
    ...(untouchedDraft ? { startDate: `${startMonth}-01`, advanceEnd: `${endMonth}-31`, monthlyAdvance: 500 } : {}),
  };
  const next = saveLoan(data, nextLoan);
  const tracking: TaxReserveTracking = account.taxReserveTracking?.loanId === loan.id
    ? account.taxReserveTracking
    : { loanId: loan.id, monthlyContribution: 850, monthlyLoan: 500, startMonth, endMonth };
  return replaceAccount(next, fundId, { ...account, taxReserveTracking: tracking });
}

export function monthlyReserveUpdate(data: FlowData, account: FundAccount, date = new Date()) {
  const totals = reserveAccountTotals(data, account);
  const tracking = account.taxReserveTracking;
  if (!tracking || !totals.loan) throw new Error("Collega prima il prestito.");
  const month = localDate(date).slice(0,7);
  const expectedLoan = !totals.loan.archived && !totals.loan.suspended && month >= tracking.startMonth && month <= tracking.endMonth ? tracking.monthlyLoan : 0;
  // Advances already entered through Loans must not be posted a second time.
  const alreadyAdvanced = data.transactions.filter(t => t.loan?.id === tracking.loanId && t.loan.kind === "advance" && t.date.startsWith(month)).reduce((sum,t) => sum + cents(t.amount),0);
  const additionalLoan = Math.max(0, cents(expectedLoan) - alreadyAdvanced) / 100;
  return { month, contribution: tracking.monthlyContribution, additionalLoan, theoretical: (cents(totals.theoretical) + cents(tracking.monthlyContribution)) / 100, principal: (cents(totals.principal) + cents(additionalLoan)) / 100, alreadyRecorded: Boolean(tracking.recordedMonths?.[month]) };
}

export interface ReserveSnapshot {
  theoretical: number;
  principal: number;
  recordMonth?: string;
}
export function saveReserveAccount(data: FlowData, fundId: string, accountId: string, snapshot: ReserveSnapshot, date = new Date()): FlowData {
  const { fund, account } = findAccount(data, fundId, accountId);
  const totals = reserveAccountTotals(data, account);
  const tracking = account.taxReserveTracking;
  if (!tracking || !totals.loan) throw new Error("Collega prima un prestito valido.");
  if (!validMoney(snapshot.theoretical) || !validMoney(snapshot.principal)) throw new Error("Inserisci importi positivi o zero, con al massimo due decimali.");
  if (cents(snapshot.principal) > cents(snapshot.theoretical)) throw new Error("Il prestito non può superare la riserva teorica.");
  const month = localDate(date).slice(0,7);
  if (snapshot.recordMonth && snapshot.recordMonth !== month) throw new Error("Conferma solo l’aggiornamento del mese corrente.");
  if (snapshot.recordMonth && tracking.recordedMonths?.[month]) throw new Error("Questo mese è già registrato. Puoi correggere i totali senza aggiungere un altro mese.");
  const contributionDelta = (cents(snapshot.theoretical) - cents(totals.theoretical)) / 100;
  let next: FlowData = { ...data, funds: data.funds.map(f => f.id === fund.id ? applyFundDelta(f, contributionDelta, accountId) : f) };
  const principalDelta = (cents(snapshot.principal) - cents(totals.principal)) / 100;
  // The balance adjustment is the manual allocation the user already performs.
  // Only the capital delta creates a transaction, excluded from income/consumption.
  if (principalDelta !== 0) {
    const loan = { ...totals.loan, fundId, fundAccountId: accountId, linkedFundId: fundId };
    next = saveLoan(next, loan);
    const kind = principalDelta > 0 ? "advance" : "repayment";
    const scheduled = loanSchedule(next, loan).find(p => p.kind === kind && p.date.startsWith(month) && cents(p.amount) === Math.abs(cents(principalDelta)));
    const start = new Date(`${loan.startDate}T12:00:00`);
    const occurrence = new Date(date.getFullYear(), date.getMonth(), Math.min(start.getDate(), new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()), 12);
    const monthlyId = `${loan.id}:monthly:${localDate(occurrence)}`;
    const matchesMonthly = kind === "advance" && cents(loan.monthlyAdvance ?? 0) === cents(principalDelta)
      && month >= loan.startDate.slice(0,7) && (!loan.advanceEnd || localDate(occurrence) <= loan.advanceEnd)
      && !next.transactions.some(t => t.loan?.planId === monthlyId);
    next = postLoanMovement(next, loan.id, {
      id: scheduled?.id ?? (matchesMonthly ? monthlyId : crypto.randomUUID()), kind, amount: Math.abs(principalDelta), date: localDate(date),
      notes: `Aggiornamento riserva ${account.name}: ${snapshot.theoretical.toFixed(2)} € teorici, ${snapshot.principal.toFixed(2)} € di capitale residuo.`,
    });
  }
  if (snapshot.recordMonth) {
    const updatedAccount = findAccount(next, fundId, accountId).account;
    next = replaceAccount(next, fundId, { ...updatedAccount, taxReserveTracking: {
      ...tracking, recordedMonths: { ...tracking.recordedMonths, [month]: { contribution: contributionDelta, loanAdvance: Math.max(0, principalDelta) } },
    } });
  }
  return next;
}

export function updateReservePreferences(data: FlowData, fundId: string, accountId: string, preferences: Pick<TaxReserveTracking, "monthlyContribution" | "monthlyLoan" | "endMonth">): FlowData {
  const { account } = findAccount(data, fundId, accountId);
  if (!account.taxReserveTracking) throw new Error("Attiva prima il monitoraggio.");
  if (!validMoney(preferences.monthlyContribution) || !validMoney(preferences.monthlyLoan) || preferences.monthlyLoan > preferences.monthlyContribution) throw new Error("Controlla accantonamento e prestito mensile.");
  if (!/^\d{4}-\d{2}$/.test(preferences.endMonth) || preferences.endMonth < account.taxReserveTracking.startMonth) throw new Error("La fine del periodo precede l’inizio.");
  const loan = data.loans?.find(l => l.id === account.taxReserveTracking?.loanId);
  const [year, month] = preferences.endMonth.split("-").map(Number);
  const advanceEnd = localDate(new Date(year, month, 0, 12));
  const next = loan ? saveLoan(data, { ...loan, monthlyAdvance: preferences.monthlyLoan, advanceEnd }) : data;
  return replaceAccount(next, fundId, { ...account, taxReserveTracking: { ...account.taxReserveTracking, ...preferences } });
}
