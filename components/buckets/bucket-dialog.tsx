"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Loader2 } from "lucide-react";
import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useFinance } from "@/components/finance-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { money } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Inserisci un nome"),
  kind: z.enum(["tax", "emergency", "home", "car", "savings", "investment", "free", "custom"]),
  color: z.string(),
  currency: z.enum(["EUR", "CHF"]),
  account_id: z.string().min(1, "Seleziona un conto"),
  allocated: z.coerce.number().nonnegative(),
});
type Values = z.infer<typeof schema>;

export function BucketDialog({ children }: { children: ReactNode }) {
  const { accounts, addBucket } = useFinance();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", kind: "savings", color: "#2563eb", currency: "EUR", account_id: "", allocated: 0 },
  });
  const currency = useWatch({ control: form.control, name: "currency" });
  const accountId = useWatch({ control: form.control, name: "account_id" });
  const allocatedValue = useWatch({ control: form.control, name: "allocated" });
  const allocated = Math.round((allocatedValue || 0) * 100);
  const selectedAccount = accounts.find((account) => account.id === accountId);
  const exceedsBalance = Boolean(selectedAccount && allocated > Math.max(0, selectedAccount.current_balance));

  async function submit(values: Values) {
    if (exceedsBalance) return;
    try {
      await addBucket({
        name: values.name,
        kind: values.kind,
        color: values.color,
        currency: values.currency,
        allocated: Math.round(values.allocated * 100),
        account_id: values.account_id,
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      toast.error("Bucket non creato", { description: error instanceof Error ? error.message : "Controlla che le allocazioni non superino il saldo." });
    }
  }
  const trigger = isValidElement(children) ? cloneElement(children as ReactElement<{ onClick?: () => void }>, { onClick: () => setOpen(true) }) : children;
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Nuovo bucket" description="Classifica una parte di un saldo esistente: non crea nuovo patrimonio.">
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <Field label="Nome"><Input placeholder="Es. Fondo emergenze" {...form.register("name")} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Destinazione">
              <Select {...form.register("kind")}><option value="tax">Tasse</option><option value="emergency">Emergenze</option><option value="home">Casa</option><option value="car">Auto</option><option value="savings">Risparmio generale</option><option value="investment">Investimenti</option><option value="free">Soldi liberi</option><option value="custom">Personalizzato</option></Select>
            </Field>
            <Field label="Colore"><Input type="color" className="p-2" {...form.register("color")} /></Field>
          </div>
          <div className="grid grid-cols-[1fr_90px] gap-3">
            <Field label="Conto">
              <Select {...form.register("account_id")}><option value="">Seleziona…</option>{accounts.filter((account) => account.currency === currency && account.type !== "credit_card").map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select>
            </Field>
            <Field label="Valuta"><Select {...form.register("currency")}><option>EUR</option><option>CHF</option></Select></Field>
          </div>
          <Field label="Importo assegnato"><Input type="number" step="0.01" {...form.register("allocated")} /></Field>
          {exceedsBalance && selectedAccount ? (
            <div className="flex gap-3 rounded-xl border border-red-500/25 bg-red-500/8 p-3 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0" />
              L’assegnazione supera il saldo di {money(selectedAccount.current_balance, selectedAccount.currency)}.
            </div>
          ) : null}
          <Button disabled={form.formState.isSubmitting || exceedsBalance}>{form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}Crea bucket</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
