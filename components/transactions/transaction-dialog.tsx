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
import type { Transaction, TransactionType } from "@/lib/types";

const schema = z
  .object({
    description: z.string().min(2, "Inserisci una descrizione"),
    amount: z.coerce.number().positive("L’importo deve essere positivo"),
    currency: z.enum(["EUR", "CHF"]),
    transaction_date: z.string().min(1),
    type: z.enum([
      "income",
      "expense",
      "transfer",
      "refund_received",
      "refund_paid",
      "allocation",
      "disinvestment",
      "investment",
      "credit_card_payment",
    ]),
    source_account_id: z.string().optional(),
    destination_account_id: z.string().optional(),
    person: z.string().optional(),
    notes: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (["expense", "refund_paid", "investment", "allocation", "credit_card_payment"].includes(value.type) && !value.source_account_id) {
      ctx.addIssue({ code: "custom", path: ["source_account_id"], message: "Seleziona il conto di origine" });
    }
    if (["income", "refund_received", "disinvestment"].includes(value.type) && !value.destination_account_id) {
      ctx.addIssue({ code: "custom", path: ["destination_account_id"], message: "Seleziona il conto di destinazione" });
    }
    if (value.type === "transfer" && (!value.source_account_id || !value.destination_account_id)) {
      ctx.addIssue({ code: "custom", path: ["destination_account_id"], message: "Servono entrambi i conti" });
    }
    if (value.type === "transfer" && value.source_account_id === value.destination_account_id) {
      ctx.addIssue({ code: "custom", path: ["destination_account_id"], message: "I conti devono essere diversi" });
    }
  });

type Values = z.infer<typeof schema>;

const labels: Record<TransactionType, string> = {
  income: "Entrata",
  expense: "Uscita",
  transfer: "Trasferimento",
  refund_received: "Rimborso ricevuto",
  refund_paid: "Rimborso pagato",
  allocation: "Accantonamento",
  disinvestment: "Disinvestimento",
  investment: "Investimento",
  credit_card_payment: "Pagamento carta",
};

export function TransactionDialog({
  children,
  transaction,
  preset,
}: {
  children: ReactNode;
  transaction?: Transaction;
  preset?: Partial<Transaction>;
}) {
  const { accounts, addTransaction, updateTransaction } = useFinance();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: transaction?.description ?? preset?.description ?? "",
      amount: transaction ? transaction.amount / 100 : preset?.amount ? preset.amount / 100 : undefined,
      currency: transaction?.currency ?? preset?.currency ?? "EUR",
      transaction_date: transaction?.transaction_date ?? preset?.transaction_date ?? new Date().toISOString().slice(0, 10),
      type: transaction?.type ?? preset?.type ?? "expense",
      source_account_id: transaction?.source_account_id ?? preset?.source_account_id ?? "",
      destination_account_id: transaction?.destination_account_id ?? preset?.destination_account_id ?? "",
      person: transaction?.person ?? preset?.person ?? "",
      notes: transaction?.notes ?? preset?.notes ?? "",
    },
  });
  const type = useWatch({ control: form.control, name: "type" });
  const currency = useWatch({ control: form.control, name: "currency" });
  const eligibleAccounts = accounts.filter((account) => account.currency === currency);
  const needsSource = ["expense", "transfer", "refund_paid", "investment", "allocation", "credit_card_payment"].includes(type);
  const needsDestination = ["income", "transfer", "refund_received", "disinvestment"].includes(type);

  async function submit(values: Values) {
    const payload = {
      ...values,
      amount: Math.round(values.amount * 100),
      source_account_id: values.source_account_id || null,
      destination_account_id: values.destination_account_id || null,
      person: values.person || null,
      notes: values.notes || null,
      credit_card_id:
        preset?.credit_card_id ??
        (values.type === "expense" &&
        accounts.find((account) => account.id === values.source_account_id)?.type === "credit_card"
          ? values.source_account_id
          : null),
    };
    try {
      if (transaction) await updateTransaction(transaction.id, payload);
      else await addTransaction(payload);
      setOpen(false);
      if (!transaction) form.reset({ ...form.getValues(), description: "", amount: undefined, notes: "" });
    } catch (error) {
      toast.error("Non è stato possibile salvare", {
        description: error instanceof Error ? error.message : "Riprova tra poco.",
      });
    }
  }

  const trigger = isValidElement(children)
    ? cloneElement(children as ReactElement<{ onClick?: () => void }>, {
        onClick: () => setOpen(true),
      })
    : children;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={transaction ? "Modifica movimento" : "Nuovo movimento"}
        description="Gli importi vengono salvati in centesimi. EUR e CHF restano separati."
      >
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <Field label="Tipo">
            <Select {...form.register("type")}>
              {Object.entries(labels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Descrizione" error={form.formState.errors.description?.message}>
            <Input placeholder="Es. Spesa alimentare" {...form.register("description")} />
          </Field>
          <div className="grid grid-cols-[1fr_110px] gap-3">
            <Field label="Importo" error={form.formState.errors.amount?.message}>
              <Input type="number" inputMode="decimal" step="0.01" placeholder="0,00" {...form.register("amount")} />
            </Field>
            <Field label="Valuta">
              <Select {...form.register("currency")}>
                <option value="EUR">EUR</option>
                <option value="CHF">CHF</option>
              </Select>
            </Field>
          </div>
          <Field label="Data">
            <Input type="date" {...form.register("transaction_date")} />
          </Field>
          {needsSource ? (
            <Field label={type === "transfer" ? "Da conto" : "Conto / carta"} error={form.formState.errors.source_account_id?.message}>
              <Select {...form.register("source_account_id")}>
                <option value="">Seleziona…</option>
                {eligibleAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          {needsDestination ? (
            <Field label={type === "transfer" ? "A conto" : "Conto di accredito"} error={form.formState.errors.destination_account_id?.message}>
              <Select {...form.register("destination_account_id")}>
                <option value="">Seleziona…</option>
                {eligibleAccounts.map((account) => (
                  <option key={account.id} value={account.id}>{account.name}</option>
                ))}
              </Select>
            </Field>
          ) : null}
          {(type === "refund_received" || type === "refund_paid") ? (
            <Field label="Persona">
              <Input placeholder="Nome" {...form.register("person")} />
            </Field>
          ) : null}
          <Field label="Note">
            <Textarea placeholder="Opzionali" {...form.register("notes")} />
          </Field>
          <Button disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {transaction ? "Salva modifiche" : "Registra movimento"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
