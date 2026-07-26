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
import type { TaxFund } from "@/lib/types";

const schema = z.object({
  name: z.string().min(2),
  reference_period: z.string().min(7),
  expected_amount: z.coerce.number().positive(),
  allocated_amount: z.coerce.number().nonnegative(),
  currency: z.enum(["EUR", "CHF"]),
  status: z.enum(["to_allocate", "partial", "allocated", "used", "closed"]),
  account_id: z.string().optional(),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function TaxDialog({ children, item }: { children: ReactNode; item?: TaxFund }) {
  const { accounts, addTaxFund, updateTaxFund } = useFinance();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: item?.name ?? "",
      reference_period: item?.reference_period ?? new Date().toISOString().slice(0, 7),
      expected_amount: item ? item.expected_amount / 100 : 0,
      allocated_amount: item ? item.allocated_amount / 100 : 0,
      currency: item?.currency ?? "EUR",
      status: item?.status ?? "to_allocate",
      account_id: item?.account_id ?? "",
      notes: item?.notes ?? "",
    },
  });
  const currency = useWatch({ control: form.control, name: "currency" });
  async function submit(values: Values) {
    try {
      const payload = {
        ...values,
        expected_amount: Math.round(values.expected_amount * 100),
        allocated_amount: Math.round(values.allocated_amount * 100),
        account_id: values.account_id || null,
        notes: values.notes || null,
      };
      if (item) await updateTaxFund(item.id, payload);
      else await addTaxFund(payload);
      setOpen(false);
    } catch (error) {
      toast.error("Salvataggio non riuscito", { description: error instanceof Error ? error.message : "Riprova." });
    }
  }
  const trigger = isValidElement(children) ? cloneElement(children as ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) }) : children;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={item ? "Modifica fondo fiscale" : "Nuovo fondo fiscale"} description="L’accantonamento riduce i soldi liberi, ma non il saldo del conto.">
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <Field label="Nome"><Input {...form.register("name")} placeholder="Es. Agosto Trade" /></Field>
          <Field label="Periodo di riferimento"><Input type="month" {...form.register("reference_period")} /></Field>
          <div className="grid grid-cols-[1fr_1fr_90px] gap-3">
            <Field label="Previsto"><Input type="number" step="0.01" {...form.register("expected_amount")} /></Field>
            <Field label="Accantonato"><Input type="number" step="0.01" {...form.register("allocated_amount")} /></Field>
            <Field label="Valuta"><Select {...form.register("currency")}><option>EUR</option><option>CHF</option></Select></Field>
          </div>
          <Field label="Stato">
            <Select {...form.register("status")}><option value="to_allocate">Da accantonare</option><option value="partial">Parziale</option><option value="allocated">Accantonato</option><option value="used">Usato per pagamento</option><option value="closed">Chiuso</option></Select>
          </Field>
          <Field label="Conto in cui si trova">
            <Select {...form.register("account_id")}><option value="">Da definire</option>{accounts.filter((account) => account.currency === currency).map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>
          </Field>
          <Field label="Note"><Textarea {...form.register("notes")} /></Field>
          <Button disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}{item ? "Salva modifiche" : "Crea fondo"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
