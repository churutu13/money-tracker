"use client";

import { CalendarClock, HandCoins, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { useFinance } from "@/components/finance-provider";
import { ReceivableDialog } from "@/components/receivables/receivable-dialog";
import { ReceivablePaymentDialog } from "@/components/receivables/payment-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn, money, percent, type Currency } from "@/lib/utils";

export default function ReceivablesPage() {
  const { receivables, removeReceivable } = useFinance();
  const total = (currency: Currency) => receivables.filter((item) => item.currency === currency && !["settled", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Math.max(0, item.original_amount - item.received_amount), 0);
  async function remove(id: string) {
    try { await removeReceivable(id); } catch (error) { toast.error("Eliminazione non riuscita", { description: error instanceof Error ? error.message : "Riprova." }); }
  }
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-semibold tracking-tight">Crediti</h2><p className="mt-1 text-sm text-muted-foreground">Soldi che devono ancora restituirti.</p></div><ReceivableDialog><Button><Plus className="size-4" /> Nuovo credito</Button></ReceivableDialog></div>
      <div className="grid gap-3 sm:grid-cols-2"><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Da ricevere · EUR</p><p className="mt-2 text-3xl font-semibold text-blue-600">{money(total("EUR"))}</p><p className="mt-1 text-xs text-muted-foreground">Non incluso nei soldi liberi</p></CardContent></Card><Card><CardContent className="p-5"><p className="text-xs text-muted-foreground">Da ricevere · CHF</p><p className="mt-2 text-3xl font-semibold text-blue-600">{money(total("CHF"), "CHF")}</p><p className="mt-1 text-xs text-muted-foreground">Valuta separata</p></CardContent></Card></div>
      <div className="grid gap-4 xl:grid-cols-2">
        {receivables.map((item) => {
          const remaining = Math.max(0, item.original_amount - item.received_amount);
          const pct = percent(item.received_amount, item.original_amount);
          return (
            <Card key={item.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-600"><UserRound className="size-5" /></div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.person}</h3><Badge tone={item.status === "settled" ? "positive" : item.status === "late" ? "danger" : item.status === "partial" ? "warning" : "info"}>{item.status === "partial" ? "Parziale" : item.status === "active" ? "Attivo" : item.status === "settled" ? "Saldato" : item.status === "late" ? "In ritardo" : "Annullato"}</Badge></div><p className="mt-1 text-sm text-muted-foreground">{item.description}</p></div>
                  <ReceivableDialog item={item}><Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground"><Pencil className="size-4" /></Button></ReceivableDialog>
                  <Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground hover:text-destructive" onClick={() => remove(item.id)}><Trash2 className="size-4" /></Button>
                </div>
                <div className="mt-5"><div className="flex items-end justify-between"><div><p className="text-xs text-muted-foreground">Residuo</p><p className={cn("mt-1 text-2xl font-semibold", remaining === 0 && "text-emerald-600")}>{money(remaining, item.currency)}</p></div><span className="text-sm font-semibold">{pct}% ricevuto</span></div><Progress value={pct} className="mt-3" /></div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                  <div className="text-xs text-muted-foreground">{item.total_installments ? `${item.received_installments ?? 0} di ${item.total_installments} rate` : "Rimborso libero"}{item.next_due_date ? <span> · <CalendarClock className="mx-1 inline size-3.5" />{format(parseISO(item.next_due_date), "d MMM", { locale: it })}</span> : null}</div>
                  {remaining > 0 && item.status !== "cancelled" ? <ReceivablePaymentDialog item={item} /> : <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600"><HandCoins className="size-4" />Completato</span>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
