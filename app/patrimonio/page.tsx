"use client";

import { ChartNoAxesCombined, CircleMinus, CirclePlus, Layers3, Landmark, Plus, ShieldCheck } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { BucketDialog } from "@/components/buckets/bucket-dialog";
import { useFinance } from "@/components/finance-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { money, type Currency } from "@/lib/utils";

const kindLabels: Record<string, string> = {
  tax: "Tasse",
  emergency: "Emergenze",
  home: "Casa",
  car: "Auto",
  savings: "Risparmio",
  investment: "Investimenti",
  free: "Soldi liberi",
  custom: "Personalizzato",
};

export default function WealthPage() {
  const { accounts, buckets, receivables, taxFunds } = useFinance();
  const calculate = (currency: Currency) => {
    const cash = accounts.filter((account) => account.currency === currency && !["investment", "credit_card"].includes(account.type)).reduce((sum, account) => sum + account.current_balance, 0);
    const investments = accounts.filter((account) => account.currency === currency && account.type === "investment").reduce((sum, account) => sum + account.current_balance, 0);
    const cardDebt = accounts.filter((account) => account.currency === currency && account.type === "credit_card").reduce((sum, account) => sum + Math.max(0, -account.current_balance), 0);
    const credits = receivables.filter((item) => item.currency === currency && !["settled", "cancelled"].includes(item.status)).reduce((sum, item) => sum + Math.max(0, item.original_amount - item.received_amount), 0);
    const reserved = taxFunds.filter((item) => item.currency === currency && !["used", "closed"].includes(item.status)).reduce((sum, item) => sum + item.allocated_amount, 0);
    return { cash, investments, cardDebt, credits, reserved, net: cash + investments + credits - cardDebt };
  };
  const eur = calculate("EUR");
  const chf = calculate("CHF");
  const chartData = buckets.filter((bucket) => bucket.currency === "EUR" && bucket.allocated > 0).map((bucket) => ({ name: bucket.name, value: bucket.allocated / 100, color: bucket.color }));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-2xl font-semibold tracking-tight">Patrimonio</h2><p className="mt-1 text-sm text-muted-foreground">Ciò che possiedi, ciò che è riservato e ciò che devi.</p></div>
        <BucketDialog><Button><Plus className="size-4" /> Nuovo bucket</Button></BucketDialog>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {([{ currency: "EUR" as const, value: eur }, { currency: "CHF" as const, value: chf }]).map(({ currency, value }) => (
          <Card key={currency} className={currency === "EUR" ? "border-primary/25" : undefined}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Patrimonio netto {currency}</p><p className="mt-2 text-3xl font-semibold tracking-[-.04em]">{money(value.net, currency)}</p></div><div className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary"><ChartNoAxesCombined className="size-5" /></div></div>
              <div className="mt-5 grid grid-cols-2 gap-y-4 border-t pt-4 text-sm">
                <div><p className="text-xs text-muted-foreground">Liquidità</p><p className="mt-1 font-semibold">{money(value.cash, currency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Investimenti</p><p className="mt-1 font-semibold">{money(value.investments, currency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Crediti</p><p className="mt-1 font-semibold text-blue-600">{money(value.credits, currency)}</p></div>
                <div><p className="text-xs text-muted-foreground">Debiti carta</p><p className="mt-1 font-semibold text-destructive">− {money(value.cardDebt, currency)}</p></div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-amber-500/8 p-3 text-xs"><span className="flex items-center gap-2 text-muted-foreground"><ShieldCheck className="size-4 text-amber-600" />Di cui fondi fiscali</span><strong>{money(value.reserved, currency)}</strong></div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[.75fr_1.25fr]">
        <Card>
          <CardHeader><div><CardTitle>Destinazione saldi EUR</CardTitle><p className="mt-1 text-xs text-muted-foreground">Classificazione, non denaro aggiuntivo</p></div></CardHeader>
          <CardContent className="h-72">
            {chartData.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={chartData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={3}>{chartData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie><Tooltip formatter={(value) => money(Number(value) * 100)} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }} /></PieChart>
              </ResponsiveContainer>
            ) : <div className="grid h-full place-items-center text-sm text-muted-foreground">Nessun bucket EUR</div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Bucket</CardTitle><p className="mt-1 text-xs text-muted-foreground">Ogni euro viene contato una volta sola</p></div><Layers3 className="size-5 text-primary" /></CardHeader>
          <CardContent className="space-y-3 pt-4">
            {buckets.map((bucket) => (
              <div key={bucket.id} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="size-3 rounded-full" style={{ backgroundColor: bucket.color }} />
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{bucket.name}</p><p className="text-xs text-muted-foreground">{kindLabels[bucket.kind] ?? bucket.kind}</p></div>
                <Badge>{bucket.currency}</Badge>
                <strong className="text-sm">{money(bucket.allocated, bucket.currency)}</strong>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
          <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600"><CirclePlus className="size-5" /></div><div><p className="text-xs text-muted-foreground">Attività</p><p className="mt-1 font-semibold">Conti + investimenti + crediti</p></div></div>
          <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-red-500/10 text-red-600"><CircleMinus className="size-5" /></div><div><p className="text-xs text-muted-foreground">Passività</p><p className="mt-1 font-semibold">Carte + debiti</p></div></div>
          <div className="flex gap-3"><div className="grid size-10 place-items-center rounded-xl bg-blue-500/10 text-blue-600"><Landmark className="size-5" /></div><div><p className="text-xs text-muted-foreground">Regola</p><p className="mt-1 font-semibold">EUR e CHF mai sommati</p></div></div>
        </CardContent>
      </Card>
    </div>
  );
}
