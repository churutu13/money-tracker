"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Receivable } from "@/lib/types";

const schema = z.object({
  person: z.string().min(2),
  description: z.string().min(2),
  original_amount: z.coerce.number().positive(),
  received_amount: z.coerce.number().nonnegative(),
  currency: z.enum(["EUR", "CHF"]),
  total_installments: z.coerce.number().int().nonnegative().optional(),
  received_installments: z.coerce.number().int().nonnegative(),
  next_due_date: z.string().optional(),
  status: z.enum(["active", "partial", "settled", "late", "cancelled"]),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function ReceivableDialog({ children, item }: { children: ReactNode; item?: Receivable }) {
  const { addReceivable, updateReceivable } = useFinance();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      person: item?.person ?? "",
      description: item?.description ?? "",
      original_amount: item ? item.original_amount / 100 : 0,
      received_amount: item ? item.received_amount / 100 : 0,
      currency: item?.currency ?? "EUR",
      total_installments: item?.total_installments ?? 0,
      received_installments: item?.received_installments ?? 0,
      next_due_date: item?.next_due_date ?? "",
      status: item?.status ?? "active",
      notes: item?.notes ?? "",
    },
  });
  async function submit(values: Values) {
    try {
      const payload = {
        ...values,
        original_amount: Math.round(values.original_amount * 100),
        received_amount: Math.round(values.received_amount * 100),
        total_installments: values.total_installments || null,
        next_due_date: values.next_due_date || null,
        notes: values.notes || null,
      };
      if (item) await updateReceivable(item.id, payload);
      else await addReceivable(payload);
      setOpen(false);
    } catch (error) {
      toast.error("Salvataggio non riuscito", { description: error instanceof Error ? error.message : "Riprova." });
    }
  }
  const trigger = isValidElement(children) ? cloneElement(children as ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) }) : children;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={item ? "Modifica credito" : "Nuovo credito"} description="Un credito non viene contato come denaro disponibile finché non lo incassi.">
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <div className="grid grid-cols-2 gap-3"><Field label="Persona"><Input {...form.register("person")} /></Field><Field label="Descrizione"><Input {...form.register("description")} /></Field></div>
          <div className="grid grid-cols-[1fr_1fr_90px] gap-3"><Field label="Originario"><Input type="number" step="0.01" {...form.register("original_amount")} /></Field><Field label="Già ricevuto"><Input type="number" step="0.01" {...form.register("received_amount")} /></Field><Field label="Valuta"><Select {...form.register("currency")}><option>EUR</option><option>CHF</option></Select></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Rate totali"><Input type="number" {...form.register("total_installments")} /></Field><Field label="Rate ricevute"><Input type="number" {...form.register("received_installments")} /></Field></div>
          <div className="grid grid-cols-2 gap-3"><Field label="Prossima scadenza"><Input type="date" {...form.register("next_due_date")} /></Field><Field label="Stato"><Select {...form.register("status")}><option value="active">Attivo</option><option value="partial">Parziale</option><option value="settled">Saldato</option><option value="late">In ritardo</option><option value="cancelled">Annullato</option></Select></Field></div>
          <Field label="Note"><Textarea {...form.register("notes")} /></Field>
          <Button disabled={form.formState.isSubmitting}>{form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}{item ? "Salva modifiche" : "Crea credito"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
