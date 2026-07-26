"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { BudgetItem } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Inserisci un nome"),
  amount: z.coerce.number().min(0, "Importo non valido"),
  currency: z.enum(["EUR", "CHF"]),
  direction: z.enum(["income", "expense"]),
  status: z.enum(["planned", "due", "paid", "postponed", "cancelled", "partial"]),
  frequency: z.enum(["once", "monthly", "weekly", "yearly", "custom"]),
  expected_date: z.string().optional(),
  account_id: z.string().optional(),
  notes: z.string().optional(),
  is_estimate: z.boolean(),
  rollover: z.boolean(),
});
type Values = z.infer<typeof schema>;

export function BudgetDialog({ children, item }: { children: ReactNode; item?: BudgetItem }) {
  const { accounts, addBudgetItem, updateBudgetItem, selectedMonth } = useFinance();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? "",
      amount: item ? item.amount / 100 : 0,
      currency: item?.currency ?? "EUR",
      direction: item?.direction ?? "expense",
      status: item?.status ?? "planned",
      frequency: item?.frequency ?? "once",
      expected_date: item?.expected_date ?? selectedMonth,
      account_id: item?.account_id ?? "",
      notes: item?.notes ?? "",
      is_estimate: item?.is_estimate ?? false,
      rollover: item?.rollover ?? false,
    },
  });
  const currency = useWatch({ control: form.control, name: "currency" });

  async function submit(values: Values) {
    const payload = {
      ...values,
      amount: Math.round(values.amount * 100),
      expected_date: values.expected_date || null,
      account_id: values.account_id || null,
      notes: values.notes || null,
    };
    try {
      if (item) await updateBudgetItem(item.id, payload);
      else await addBudgetItem(payload);
      setOpen(false);
    } catch (error) {
      toast.error("Salvataggio non riuscito", { description: error instanceof Error ? error.message : "Riprova." });
    }
  }

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) })
    : children;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={item ? "Modifica voce" : "Nuova voce di budget"} description="Pianifica un’entrata o un’uscita senza toccare ancora i saldi.">
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <Field label="Nome" error={form.formState.errors.name?.message}>
            <Input placeholder="Es. Affitto" {...form.register("name")} />
          </Field>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="Importo" error={form.formState.errors.amount?.message}>
              <Input type="number" step="0.01" inputMode="decimal" {...form.register("amount")} />
            </Field>
            <Field label="Valuta">
              <Select {...form.register("currency")}><option>EUR</option><option>CHF</option></Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo">
              <Select {...form.register("direction")}><option value="expense">Uscita</option><option value="income">Entrata</option></Select>
            </Field>
            <Field label="Stato">
              <Select {...form.register("status")}>
                <option value="planned">Previsto</option>
                <option value="due">Da pagare</option>
                <option value="paid">Pagato</option>
                <option value="postponed">Posticipato</option>
                <option value="cancelled">Annullato</option>
                <option value="partial">Parziale</option>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data prevista">
              <Input type="date" {...form.register("expected_date")} />
            </Field>
            <Field label="Frequenza">
              <Select {...form.register("frequency")}>
                <option value="once">Una tantum</option>
                <option value="monthly">Mensile</option>
                <option value="weekly">Settimanale</option>
                <option value="yearly">Annuale</option>
                <option value="custom">Personalizzata</option>
              </Select>
            </Field>
          </div>
          <Field label="Conto o carta prevista">
            <Select {...form.register("account_id")}>
              <option value="">Da definire</option>
              {accounts.filter((account) => account.currency === currency).map((account) => (
                <option key={account.id} value={account.id}>{account.name}</option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" {...form.register("is_estimate")} />
              Importo stimato
            </label>
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
              <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" {...form.register("rollover")} />
              Sposta al mese dopo
            </label>
          </div>
          <Field label="Note">
            <Textarea placeholder="Etichette o dettagli utili" {...form.register("notes")} />
          </Field>
          <Button disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {item ? "Salva modifiche" : "Aggiungi al budget"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
