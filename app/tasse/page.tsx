"use client";

import { CheckCircle2, Coins, Pencil, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { format, parse } from "date-fns";
import { it } from "date-fns/locale";
import { toast } from "sonner";
import { useFinance } from "@/components/finance-provider";
import { TaxDialog } from "@/components/taxes/tax-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaxFund } from "@/lib/types";
import { cn, money, percent, type Currency } from "@/lib/utils";

const statusLabel: Record<TaxFund["status"], string> = {
  to_allocate: "Da accantonare",
  partial: "Parziale",
  allocated: "Accantonato",
  used: "Utilizzato",
  closed: "Chiuso",
};

export default function TaxesPage() {
  const { taxFunds, accounts, removeTaxFund } = useFinance();
  const totals = (currency: Currency) => {
    const relevant = taxFunds.filter((item) => item.currency === currency && !["used", "closed"].includes(item.status));
    const expected = relevant.reduce((sum, item) => sum + item.expected_amount, 0);
    const allocated = relevant.reduce((sum, item) => sum + item.allocated_amount, 0);
    return { expected, allocated, remaining: Math.max(0, expected - allocated) };
  };

  async function remove(id: string) {
    try { await removeTaxFund(id); } catch (error) { toast.error("Eliminazione non riuscita", { description: error instanceof Error ? error.message : "Riprova." }); }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Accantonamenti tasse</h2><p className="mt-1 text-sm text-muted-foreground">Denaro presente, ma non libero da spendere.</p></div>
        <TaxDialog><Button><Plus className="size-4" /> Nuovo fondo</Button></TaxDialog>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {(["EUR", "CHF"] as Currency[]).map((currency) => {
          const value = totals(currency);
          return (
            <Card key={currency} className={cn(currency === "EUR" && "border-primary/25")}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between"><div><p className="text-xs font-semibold tracking-wider text-muted-foreground">TASSE {currency}</p><p className="mt-2 text-3xl font-semibold">{money(value.allocated, currency)}</p></div><div className="grid size-11 place-items-center rounded-xl bg-amber-500/10 text-amber-700"><ShieldCheck className="size-5" /></div></div>
                <div className="mt-5 grid grid-cols-2 border-t pt-4 text-sm"><div><p className="text-xs text-muted-foreground">Previsto</p><p className="mt-1 font-semibold">{money(value.expected, currency)}</p></div><div><p className="text-xs text-muted-foreground">Ancora da accantonare</p><p className="mt-1 font-semibold text-amber-700 dark:text-amber-400">{money(value.remaining, currency)}</p></div></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {taxFunds.map((item) => {
          const pct = percent(item.allocated_amount, item.expected_amount);
          return (
            <Card key={item.id}>
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <div className="grid size-11 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-700"><Coins className="size-5" /></div>
                  <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{item.name}</h3><Badge tone={item.status === "allocated" ? "positive" : item.status === "partial" ? "warning" : "neutral"}>{statusLabel[item.status]}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{format(parse(item.reference_period, "yyyy-MM", new Date()), "MMMM yyyy", { locale: it })} · {accounts.find((account) => account.id === item.account_id)?.name ?? "conto da definire"}</p></div>
                  <TaxDialog item={item}><Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground"><Pencil className="size-4" /></Button></TaxDialog>
                  <Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground hover:text-destructive" onClick={() => remove(item.id)}><Trash2 className="size-4" /></Button>
                </div>
                <div className="mt-5 flex items-end justify-between rounded-xl bg-muted/50 p-4"><div><p className="text-xs text-muted-foreground">Accantonato</p><p className="mt-1 text-xl font-semibold">{money(item.allocated_amount, item.currency)} <span className="text-sm font-normal text-muted-foreground">di {money(item.expected_amount, item.currency)}</span></p></div><div className="flex items-center gap-2 text-sm font-semibold"><CheckCircle2 className={cn("size-4", pct === 100 ? "text-emerald-600" : "text-amber-600")} />{pct}%</div></div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
