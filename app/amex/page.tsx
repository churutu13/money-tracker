"use client";

import { addMonths, format, startOfMonth } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarClock, CheckCircle2, CreditCard, Plus, ReceiptText, ShieldCheck } from "lucide-react";
import { useFinance } from "@/components/finance-provider";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money } from "@/lib/utils";

export default function AmexPage() {
  const { accounts, transactions, selectedMonth } = useFinance();
  const amex = accounts.find((account) => account.type === "credit_card");
  const monthPrefix = selectedMonth.slice(0, 7);
  const expenses = transactions.filter((tx) => tx.transaction_date.startsWith(monthPrefix) && (tx.credit_card_id === amex?.id || tx.source_account_id === amex?.id) && tx.type === "expense");
  const payments = transactions.filter((tx) => tx.transaction_date.startsWith(monthPrefix) && tx.type === "credit_card_payment" && tx.destination_account_id === amex?.id);
  const spent = expenses.reduce((sum, tx) => sum + tx.amount, 0);
  const paid = payments.reduce((sum, tx) => sum + tx.amount, 0);
  const debt = Math.max(0, -(amex?.current_balance ?? 0));
  const dueDate = new Date(addMonths(startOfMonth(new Date(`${selectedMonth}T12:00:00`)), 1).setDate(10));

  if (!amex) {
    return (
      <div className="grid min-h-[60vh] place-items-center text-center">
        <div><CreditCard className="mx-auto size-10 text-muted-foreground" /><h2 className="mt-4 text-xl font-semibold">Nessuna carta di credito</h2><p className="mt-1 text-sm text-muted-foreground">Crea un conto di tipo carta di credito nella sezione Conti.</p></div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Carta Amex</h2><p className="mt-1 text-sm text-muted-foreground">Spesa registrata subito, addebito sul conto una sola volta.</p></div>
        <div className="flex gap-2">
          <TransactionDialog preset={{ type: "expense", currency: "EUR", source_account_id: amex.id, credit_card_id: amex.id }}>
            <Button><Plus className="size-4" /> Spesa Amex</Button>
          </TransactionDialog>
          <TransactionDialog preset={{ type: "credit_card_payment", currency: "EUR", destination_account_id: amex.id, credit_card_id: amex.id, description: "Pagamento estratto conto Amex" }}>
            <Button variant="outline">Paga estratto</Button>
          </TransactionDialog>
        </div>
      </div>

      <Card className="overflow-hidden border-primary/25 bg-primary text-primary-foreground">
        <CardContent className="p-6 sm:p-8">
          <div className="flex items-start justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[.18em] opacity-65">American Express</p><p className="mt-8 text-sm opacity-70">Saldo carta</p><p className="mt-1 text-4xl font-semibold tracking-[-.04em]">{money(debt)}</p></div>
            <CreditCard className="size-8 opacity-75" />
          </div>
          <div className="mt-10 flex items-end justify-between"><div><p className="text-xs opacity-60">Carta personale</p><p className="mt-1 text-sm font-semibold">•••• 2026</p></div><Badge className="bg-white/12 text-white">EUR</Badge></div>
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Spese ciclo corrente</p><p className="mt-2 text-2xl font-semibold">{money(spent)}</p><p className="mt-1 text-xs text-muted-foreground">{expenses.length} movimenti</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Già pagato</p><p className="mt-2 text-2xl font-semibold text-emerald-600">{money(paid)}</p><p className="mt-1 text-xs text-muted-foreground">Non contato come nuova spesa</p></CardContent></Card>
        <Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Prossimo addebito</p><p className="mt-2 text-2xl font-semibold">{format(dueDate, "d MMM", { locale: it })}</p><p className="mt-1 text-xs text-muted-foreground">Conto da scegliere al pagamento</p></CardContent></Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader><div><CardTitle>Movimenti del ciclo</CardTitle><p className="mt-1 text-xs text-muted-foreground">Le spese influenzano subito il budget</p></div><ReceiptText className="size-5 text-primary" /></CardHeader>
          <CardContent className="space-y-1 pt-3">
            {expenses.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 rounded-xl p-3 hover:bg-muted/50">
                <div className="grid size-9 place-items-center rounded-xl bg-muted"><CreditCard className="size-4" /></div>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{tx.description}</p><p className="text-xs text-muted-foreground">{format(new Date(`${tx.transaction_date}T12:00:00`), "d MMMM", { locale: it })}</p></div>
                <strong className="text-sm">−{money(tx.amount)}</strong>
              </div>
            ))}
            {!expenses.length ? <p className="py-12 text-center text-sm text-muted-foreground">Nessuna spesa nel ciclo.</p> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Come funziona</CardTitle><p className="mt-1 text-xs text-muted-foreground">Nessun doppio conteggio</p></div><ShieldCheck className="size-5 text-primary" /></CardHeader>
          <CardContent className="space-y-4 pt-4">
            {[
              { icon: Plus, title: "Registri la spesa", text: "Compare tra le uscite e aumenta il debito carta." },
              { icon: CalendarClock, title: "Attendi l’estratto", text: "Il conto corrente non viene ancora toccato." },
              { icon: CheckCircle2, title: "Paghi l’estratto", text: "Diminuisce il conto e si riduce il debito, senza una seconda uscita." },
            ].map((step, index) => {
              const Icon = step.icon;
              return <div key={step.title} className="flex gap-3"><div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"><Icon className="size-4" /></div><div><p className="text-sm font-semibold">{index + 1}. {step.title}</p><p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.text}</p></div></div>;
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
