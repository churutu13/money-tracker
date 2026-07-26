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
import type { RecurringItem } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2, "Inserisci un nome"),
  amount: z.coerce.number().nonnegative(),
  currency: z.enum(["EUR", "CHF"]),
  payment_day: z.coerce.number().int().min(1).max(31),
  frequency: z.enum(["monthly", "weekly", "yearly", "custom"]),
  start_date: z.string().min(1),
  end_date: z.string().optional(),
  account_id: z.string().optional(),
  is_estimate: z.boolean(),
  active: z.boolean(),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function RecurringDialog({ children, item }: { children: ReactNode; item?: RecurringItem }) {
  const { accounts, addRecurring, updateRecurring } = useFinance();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? "",
      amount: item ? item.amount / 100 : 0,
      currency: item?.currency ?? "EUR",
      payment_day: item?.payment_day ?? 1,
      frequency: (item?.frequency as Values["frequency"]) ?? "monthly",
      start_date: item?.start_date ?? new Date().toISOString().slice(0, 10),
      end_date: item?.end_date ?? "",
      account_id: item?.account_id ?? "",
      is_estimate: item?.is_estimate ?? false,
      active: item?.active ?? true,
      notes: item?.notes ?? "",
    },
  });
  const currency = useWatch({ control: form.control, name: "currency" });

  async function submit(values: Values) {
    const payload = {
      ...values,
      amount: Math.round(values.amount * 100),
      end_date: values.end_date || null,
      account_id: values.account_id || null,
      notes: values.notes || null,
    };
    try {
      if (item) await updateRecurring(item.id, payload);
      else await addRecurring(payload);
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
      <DialogContent title={item ? "Modifica ricorrenza" : "Nuova spesa ricorrente"} description="La voce prevista viene generata una sola volta per ogni scadenza.">
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <Field label="Nome"><Input {...form.register("name")} placeholder="Es. Spotify" /></Field>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="Importo"><Input type="number" step="0.01" {...form.register("amount")} /></Field>
            <Field label="Valuta"><Select {...form.register("currency")}><option>EUR</option><option>CHF</option></Select></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Giorno"><Input type="number" min="1" max="31" {...form.register("payment_day")} /></Field>
            <Field label="Frequenza">
              <Select {...form.register("frequency")}><option value="monthly">Mensile</option><option value="weekly">Settimanale</option><option value="yearly">Annuale</option><option value="custom">Personalizzata</option></Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Data iniziale"><Input type="date" {...form.register("start_date")} /></Field>
            <Field label="Data finale"><Input type="date" {...form.register("end_date")} /></Field>
          </div>
          <Field label="Conto di addebito">
            <Select {...form.register("account_id")}><option value="">Da definire</option>{accounts.filter((account) => account.currency === currency).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>
          </Field>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" {...form.register("is_estimate")} />Importo stimato</label>
            <label className="flex items-center gap-3 rounded-xl border p-3 text-sm"><input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" {...form.register("active")} />Ricorrenza attiva</label>
          </div>
          <Field label="Note"><Textarea {...form.register("notes")} /></Field>
          <Button disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}{item ? "Salva modifiche" : "Crea ricorrenza"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
