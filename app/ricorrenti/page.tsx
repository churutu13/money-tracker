"use client";

import { differenceInCalendarMonths, format, isBefore, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarClock, Pencil, Plus, Repeat2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useFinance } from "@/components/finance-provider";
import { RecurringDialog } from "@/components/recurring/recurring-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/utils";

export default function RecurringPage() {
  const { recurring, accounts, removeRecurring } = useFinance();
  const today = new Date("2026-08-01T12:00:00");

  async function remove(id: string) {
    try {
      await removeRecurring(id);
    } catch (error) {
      toast.error("Eliminazione non riuscita", { description: error instanceof Error ? error.message : "Riprova." });
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Spese ricorrenti</h2><p className="mt-1 text-sm text-muted-foreground">Abbonamenti e impegni che si ripetono.</p></div>
        <RecurringDialog><Button><Plus className="size-4" /> Nuova ricorrenza</Button></RecurringDialog>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {recurring.map((item) => {
          const end = item.end_date ? parseISO(item.end_date) : null;
          const remaining = end && !isBefore(end, today) ? differenceInCalendarMonths(end, today) + 1 : null;
          const residual = remaining === null ? null : remaining * item.amount;
          return (
            <Card key={item.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Repeat2 className="size-5" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{item.name}</h3>
                      <Badge tone={item.active ? "positive" : "neutral"}>{item.active ? "Attiva" : "Terminata"}</Badge>
                      {item.is_estimate ? <Badge tone="warning">Stima</Badge> : null}
                    </div>
                    <p className="mt-1 text-2xl font-semibold">{money(item.amount, item.currency)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Giorno {item.payment_day ?? "—"} · {accounts.find((account) => account.id === item.account_id)?.name ?? "conto da definire"}
                    </p>
                  </div>
                  <div className="flex">
                    <RecurringDialog item={item}><Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground"><Pencil className="size-4" /></Button></RecurringDialog>
                    <Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground hover:text-destructive" onClick={() => remove(item.id)}><Trash2 className="size-4" /></Button>
                  </div>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3 border-t pt-4 text-sm">
                  <div><p className="text-xs text-muted-foreground">Prossima scadenza</p><p className="mt-1 font-semibold"><CalendarClock className="mr-1.5 inline size-3.5" />{`Giorno ${item.payment_day}`}</p></div>
                  <div><p className="text-xs text-muted-foreground">Termine</p><p className="mt-1 font-semibold">{end ? format(end, "d MMM yyyy", { locale: it }) : "Senza scadenza"}</p></div>
                  {remaining !== null ? <><div><p className="text-xs text-muted-foreground">Pagamenti rimanenti</p><p className="mt-1 font-semibold">{remaining}</p></div><div><p className="text-xs text-muted-foreground">Residuo stimato</p><p className="mt-1 font-semibold">{money(residual ?? 0, item.currency)}</p></div></> : null}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
