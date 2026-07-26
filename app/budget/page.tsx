"use client";

import { addMonths, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { CalendarPlus, Check, Clock3, Copy, Pencil, Plus, ReceiptText, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { BudgetDialog } from "@/components/budget/budget-dialog";
import { MarkPaidDialog } from "@/components/budget/mark-paid-dialog";
import { useFinance } from "@/components/finance-provider";
import { MonthSelect } from "@/components/month-select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import type { BudgetItem, BudgetStatus } from "@/lib/types";
import { cn, money, percent } from "@/lib/utils";

const statusLabels: Record<BudgetStatus, string> = {
  planned: "Previsto",
  due: "Da pagare",
  paid: "Pagato",
  postponed: "Posticipato",
  cancelled: "Annullato",
  partial: "Parziale",
};
const statusTones: Record<BudgetStatus, "neutral" | "positive" | "danger" | "warning" | "info"> = {
  planned: "neutral",
  due: "warning",
  paid: "positive",
  postponed: "info",
  cancelled: "danger",
  partial: "warning",
};

function DeleteBudgetItem({ item }: { item: BudgetItem }) {
  const { removeBudgetItem } = useFinance();
  const [open, setOpen] = useState(false);
  async function remove() {
    try {
      await removeBudgetItem(item.id);
      setOpen(false);
    } catch (error) {
      toast.error("Eliminazione non riuscita", { description: error instanceof Error ? error.message : "Riprova." });
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground hover:text-destructive"><Trash2 className="size-4" /></Button></DialogTrigger>
      <DialogContent title="Eliminare questa voce?" description="Un eventuale movimento già collegato non verrà eliminato.">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annulla</Button>
          <Button variant="destructive" className="flex-1" onClick={remove}>Elimina</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function BudgetPage() {
  const { budget, selectedMonth, duplicateBudget } = useFinance();
  const [duplicating, setDuplicating] = useState(false);
  const expenses = budget.filter((item) => item.direction === "expense" && item.status !== "cancelled");
  const incomes = budget.filter((item) => item.direction === "income" && item.status !== "cancelled");
  const paid = expenses.filter((item) => item.status === "paid");
  const total = expenses.reduce((sum, item) => sum + item.amount, 0);
  const paidTotal = paid.reduce((sum, item) => sum + item.amount, 0);
  const incomeTotal = incomes.reduce((sum, item) => sum + item.amount, 0);

  async function duplicate() {
    setDuplicating(true);
    try {
      await duplicateBudget(format(addMonths(parseISO(selectedMonth), 1), "yyyy-MM-01"));
    } catch (error) {
      toast.error("Duplicazione non riuscita", { description: error instanceof Error ? error.message : "Riprova." });
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Budget mensile</h2>
          <p className="mt-1 text-sm text-muted-foreground">Pianificato, pagato e ancora da pagare.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <MonthSelect />
          <BudgetDialog><Button><Plus className="size-4" /> Nuova voce</Button></BudgetDialog>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Entrate previste</p><p className="mt-2 text-2xl font-semibold text-emerald-600">{money(incomeTotal)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Uscite previste</p><p className="mt-2 text-2xl font-semibold">{money(total)}</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Ancora da pagare</p><p className="mt-2 text-2xl font-semibold text-amber-700 dark:text-amber-400">{money(total - paidTotal)}</p></CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-5">
          <div className="flex items-end justify-between">
            <div><p className="text-sm font-semibold">Avanzamento spese</p><p className="mt-1 text-xs text-muted-foreground">{paid.length} pagate su {expenses.length}</p></div>
            <strong className="text-2xl">{percent(paidTotal, total)}%</strong>
          </div>
          <Progress value={percent(paidTotal, total)} className="mt-4" />
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="items-center">
          <div><CardTitle>Voci di {format(parseISO(selectedMonth), "MMMM", { locale: it })}</CardTitle><p className="mt-1 text-xs text-muted-foreground">Importi certi e stimati</p></div>
          <Button variant="outline" size="sm" onClick={duplicate} disabled={duplicating}>
            <Copy className="size-3.5" /> {duplicating ? "Duplicazione…" : "Duplica nel mese dopo"}
          </Button>
        </CardHeader>
        <div className="mt-3 divide-y border-t">
          {budget.map((item) => (
            <div key={item.id} className={cn("flex flex-wrap items-center gap-3 p-4", item.status === "cancelled" && "opacity-55")}>
              <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl", item.status === "paid" ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground")}>
                {item.status === "paid" ? <Check className="size-4" /> : item.expected_date ? <Clock3 className="size-4" /> : <ReceiptText className="size-4" />}
              </div>
              <div className="min-w-40 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{item.name}</p>
                  <Badge tone={statusTones[item.status]}>{statusLabels[item.status]}</Badge>
                  {item.is_estimate ? <Badge tone="warning">Stima</Badge> : null}
                  {item.tag_names?.map((tag) => <Badge key={tag} tone="info">{tag}</Badge>)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.expected_date ? format(parseISO(item.expected_date), "d MMMM", { locale: it }) : "Data da definire"}
                  {" · "}{item.frequency === "monthly" ? "Mensile" : item.frequency === "once" ? "Una tantum" : item.frequency}
                  {item.rollover ? " · da spostare" : ""}
                </p>
              </div>
              <p className={cn("min-w-24 text-right text-sm font-semibold", item.direction === "income" && "text-emerald-600")}>
                {item.direction === "income" ? "+" : "−"}{item.amount ? money(item.amount, item.currency) : "—"}
              </p>
              <div className="ml-auto flex items-center">
                {item.status !== "paid" && item.status !== "cancelled" && item.amount > 0 ? <MarkPaidDialog item={item} /> : null}
                <BudgetDialog item={item}>
                  <Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground"><Pencil className="size-4" /></Button>
                </BudgetDialog>
                <DeleteBudgetItem item={item} />
              </div>
            </div>
          ))}
          {!budget.length ? (
            <div className="grid min-h-52 place-items-center p-6 text-center">
              <div><CalendarPlus className="mx-auto size-7 text-muted-foreground" /><p className="mt-3 font-semibold">Questo mese è ancora vuoto</p><p className="mt-1 text-sm text-muted-foreground">Aggiungi una voce o duplica il mese precedente.</p></div>
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
