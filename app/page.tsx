"use client";

import {
  AlertCircle,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CreditCard,
  ReceiptText,
  Sparkles,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import Link from "next/link";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { useFinance } from "@/components/finance-provider";
import { MonthSelect } from "@/components/month-select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn, money, percent, type Currency } from "@/lib/utils";

function AvailabilityCard({
  currency,
  balance,
  committed,
  taxes,
  savings,
  investments,
  free,
}: {
  currency: Currency;
  balance: number;
  committed: number;
  taxes: number;
  savings: number;
  investments: number;
  free: number;
}) {
  return (
    <Card className={cn("overflow-hidden", currency === "EUR" && "border-primary/25")}>
      <CardContent className="p-0">
        <div className="flex items-start justify-between p-5 pb-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">Disponibilità {currency}</p>
            <p className={cn("mt-2 text-3xl font-semibold tracking-[-.04em]", free < 0 && "text-destructive")}>
              {money(free, currency)}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">soldi liberi stimati</p>
          </div>
          <div className={cn("grid size-11 place-items-center rounded-xl", currency === "EUR" ? "bg-primary text-primary-foreground" : "bg-blue-500/10 text-blue-600")}>
            <Wallet className="size-5" />
          </div>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] border-t bg-muted/25 text-sm">
          <div className="min-w-0 border-b border-r p-4">
            <span className="block text-xs text-muted-foreground">Saldo conti</span>
            <strong className="mt-1 block truncate">{money(balance, currency)}</strong>
          </div>
          <div className="min-w-0 border-b p-4">
            <span className="block text-xs text-muted-foreground">Da pagare</span>
            <strong className="mt-1 block truncate text-amber-700 dark:text-amber-400">− {money(committed, currency)}</strong>
          </div>
          <div className="min-w-0 border-r p-4">
            <span className="block text-xs text-muted-foreground">Tasse</span>
            <strong className="mt-1 block truncate">− {money(taxes, currency)}</strong>
          </div>
          <div className="min-w-0 p-4">
            <span className="block text-xs text-muted-foreground">Risparmi · Invest.</span>
            <strong className="mt-1 block truncate text-xs sm:text-sm">{money(savings, currency)} · {money(investments, currency)}</strong>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { accounts, transactions, budget, taxFunds, receivables, buckets, loading, selectedMonth } = useFinance();

  if (loading) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-12 w-48" />
        <div className="grid gap-4 lg:grid-cols-2"><Skeleton className="h-72" /><Skeleton className="h-72" /></div>
        <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
      </div>
    );
  }

  const calculate = (currency: Currency) => {
    const liquidAccounts = accounts.filter(
      (account) =>
        account.currency === currency &&
        account.include_in_liquidity &&
        !["investment", "credit_card"].includes(account.type)
    );
    const balance = liquidAccounts.reduce((sum, account) => sum + account.current_balance, 0);
    const committed = budget
      .filter((item) => item.currency === currency && item.direction === "expense" && !["paid", "cancelled"].includes(item.status))
      .reduce((sum, item) => sum + item.amount, 0);
    const taxes = taxFunds
      .filter((item) => item.currency === currency && !["used", "closed"].includes(item.status))
      .reduce((sum, item) => sum + item.allocated_amount, 0);
    const savings = buckets
      .filter((bucket) => bucket.currency === currency && ["savings", "emergency", "home", "car"].includes(bucket.kind))
      .reduce((sum, bucket) => sum + bucket.allocated, 0);
    const investments = accounts
      .filter((account) => account.currency === currency && account.type === "investment")
      .reduce((sum, account) => sum + account.current_balance, 0);
    const cardDebt = accounts
      .filter((account) => account.currency === currency && account.type === "credit_card")
      .reduce((sum, account) => sum + Math.max(0, -account.current_balance), 0);
    const free = balance - committed - taxes - savings - cardDebt;
    return { balance, committed, taxes, savings, investments, cardDebt, free };
  };
  const eur = calculate("EUR");
  const chf = calculate("CHF");

  const monthPrefix = selectedMonth.slice(0, 7);
  const monthTransactions = transactions.filter((tx) => tx.transaction_date.startsWith(monthPrefix));
  const incomes = monthTransactions.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = monthTransactions
    .filter((tx) => ["expense", "refund_paid"].includes(tx.type))
    .reduce((sum, tx) => sum + tx.amount, 0);
  const fixed = budget.filter((item) => item.frequency !== "once" && item.direction === "expense");
  const fixedPaid = fixed.filter((item) => item.status === "paid");
  const variable = budget.filter((item) => item.frequency === "once" && item.direction === "expense").reduce((sum, item) => sum + item.amount, 0);
  const outstandingReceivables = receivables.reduce((sum, item) => sum + Math.max(0, item.original_amount - item.received_amount), 0);
  const upcoming = budget
    .filter((item) => !["paid", "cancelled"].includes(item.status) && item.expected_date)
    .sort((a, b) => String(a.expected_date).localeCompare(String(b.expected_date)))
    .slice(0, 5);

  const chartData = [1, 5, 10, 15, 20, 25, 31].map((day) => {
    const value = monthTransactions
      .filter((tx) => tx.type === "expense" && Number(tx.transaction_date.slice(8, 10)) <= day)
      .reduce((sum, tx) => sum + tx.amount / 100, 0);
    return { day: String(day), value };
  });

  return (
    <div className="space-y-5 md:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Buongiorno, ecco il quadro di</p>
          <h2 className="mt-0.5 text-2xl font-semibold capitalize tracking-tight md:text-3xl">
            {format(parseISO(selectedMonth), "MMMM yyyy", { locale: it })}
          </h2>
        </div>
        <MonthSelect />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <AvailabilityCard currency="EUR" {...eur} />
        <AvailabilityCard currency="CHF" {...chf} />
      </div>

      {(eur.free < 0 || chf.free < 0) ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/8 p-4">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-semibold">La disponibilità calcolata richiede una riconciliazione</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Il valore libero dichiarato non coincide con saldi, impegni e bucket attuali. Nessun dato è stato modificato.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Entrate del mese", value: money(incomes), icon: ArrowDownRight, tone: "text-emerald-600", sub: "incassate" },
          { label: "Uscite del mese", value: money(expenses), icon: ArrowUpRight, tone: "text-foreground", sub: "registrate" },
          { label: "Spese variabili", value: money(variable), icon: ReceiptText, tone: "text-foreground", sub: "previste" },
          { label: "Crediti residui", value: money(outstandingReceivables), icon: Banknote, tone: "text-blue-600", sub: "non disponibili" },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label}>
              <CardContent className="p-4 md:p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">{stat.label}</span>
                  <Icon className={cn("size-4", stat.tone)} />
                </div>
                <p className={cn("mt-4 text-xl font-semibold tracking-tight md:text-2xl", stat.tone)}>{stat.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{stat.sub}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_.7fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Andamento uscite</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Cumulato del mese · EUR</p>
            </div>
            <Badge tone="info">Registrato</Badge>
          </CardHeader>
          <CardContent className="h-56 px-1 pb-3 pt-5 sm:px-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="4 4" opacity={0.25} />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => money(Number(value) * 100)}
                  contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", fontSize: 12 }}
                />
                <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / .10)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Spese fisse pagate</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">{fixedPaid.length} su {fixed.length}</p>
            </div>
            <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-semibold tracking-[-.05em]">{percent(fixedPaid.length, fixed.length)}%</p>
            <Progress className="mt-4" value={percent(fixedPaid.length, fixed.length)} />
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-[11px] text-muted-foreground">Già pagate</p>
                <p className="mt-1 font-semibold">{money(fixedPaid.reduce((sum, item) => sum + item.amount, 0))}</p>
              </div>
              <div className="rounded-xl bg-muted/60 p-3">
                <p className="text-[11px] text-muted-foreground">Ancora da pagare</p>
                <p className="mt-1 font-semibold text-amber-700 dark:text-amber-400">
                  {money(fixed.filter((item) => item.status !== "paid").reduce((sum, item) => sum + item.amount, 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Prossimi pagamenti</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Impegni ancora aperti</p>
            </div>
            <Link href="/budget" className="flex items-center gap-1 text-xs font-semibold text-primary">
              Tutti <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-1 pt-3">
            {upcoming.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-muted/50">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-700">
                  <CalendarClock className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.expected_date ? format(parseISO(item.expected_date), "d MMMM", { locale: it }) : "Data da definire"}
                    {item.is_estimate ? " · stimato" : ""}
                  </p>
                </div>
                <p className="text-sm font-semibold">{item.amount ? money(item.amount, item.currency) : "—"}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Previsione fine mese</CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Stima, non saldo reale</p>
            </div>
            <TrendingUp className="size-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="rounded-xl bg-primary/[.06] p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">EUR</span>
                <strong className={cn("text-xl", eur.free + incomes - expenses < 0 && "text-destructive")}>
                  {money(eur.free + incomes - expenses)}
                </strong>
              </div>
              <div className="my-3 border-t" />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">CHF</span>
                <strong className={cn("text-xl", chf.free < 0 && "text-destructive")}>{money(chf.free, "CHF")}</strong>
              </div>
            </div>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Basata su saldi, entrate registrate, spese aperte, tasse e debito carta. Le valute non vengono convertite né sommate.
            </p>
            <div className="mt-5 flex items-center justify-between rounded-xl border p-3">
              <span className="flex items-center gap-2 text-xs text-muted-foreground"><CreditCard className="size-4" /> Utilizzo Amex</span>
              <strong className="text-sm">{money(eur.cardDebt)}</strong>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
