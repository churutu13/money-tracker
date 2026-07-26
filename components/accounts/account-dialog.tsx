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
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import type { Account } from "@/lib/types";
import { money } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Inserisci un nome"),
  type: z.enum(["checking", "cash", "savings", "investment", "credit_card", "tax"]),
  currency: z.enum(["EUR", "CHF"]),
  current_balance: z.coerce.number(),
  include_in_liquidity: z.boolean(),
  notes: z.string().optional(),
});
type Values = z.infer<typeof schema>;

export function AccountDialog({ children, account }: { children: ReactNode; account?: Account }) {
  const { addAccount, updateAccount, reconcileAccount } = useFinance();
  const [open, setOpen] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: account?.name ?? "",
      type: account?.type ?? "checking",
      currency: account?.currency ?? "EUR",
      current_balance: account ? account.current_balance / 100 : 0,
      include_in_liquidity: account?.include_in_liquidity ?? true,
      notes: account?.notes ?? "",
    },
  });
  const currentBalanceValue = useWatch({ control: form.control, name: "current_balance" });
  const currentBalance = Math.round((currentBalanceValue || 0) * 100);
  const hasBalanceDifference = Boolean(account && currentBalance !== account.current_balance);

  async function submit(values: Values) {
    try {
      const payload = {
        name: values.name,
        type: values.type,
        currency: values.currency,
        current_balance: Math.round(values.current_balance * 100),
        initial_balance: account?.initial_balance ?? Math.round(values.current_balance * 100),
        include_in_liquidity: values.include_in_liquidity,
        notes: values.notes || null,
      };
      if (account) {
        const { current_balance, ...metadata } = payload;
        await updateAccount(account.id, metadata);
        if (current_balance !== account.current_balance) {
          await reconcileAccount(account.id, current_balance, "Rettifica da riconciliazione manuale");
        }
      } else {
        await addAccount(payload);
      }
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
      <DialogContent title={account ? "Modifica conto" : "Nuovo conto"} description="Il saldo viene conservato in centesimi, senza arrotondamenti.">
        <form onSubmit={form.handleSubmit(submit)} className="grid gap-4">
          <Field label="Nome" error={form.formState.errors.name?.message}>
            <Input placeholder="Es. Conto principale" {...form.register("name")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipologia">
              <Select {...form.register("type")}>
                <option value="checking">Conto corrente</option>
                <option value="cash">Contanti</option>
                <option value="savings">Conto deposito</option>
                <option value="investment">Investimento</option>
                <option value="credit_card">Carta di credito</option>
                <option value="tax">Conto fiscale</option>
              </Select>
            </Field>
            <Field label="Valuta">
              <Select {...form.register("currency")} disabled={Boolean(account)}>
                <option value="EUR">EUR</option>
                <option value="CHF">CHF</option>
              </Select>
            </Field>
          </div>
          <Field label={account ? "Saldo riconciliato" : "Saldo iniziale"}>
            <Input type="number" step="0.01" inputMode="decimal" {...form.register("current_balance")} />
          </Field>
          {hasBalanceDifference && account ? (
            <div className="flex gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <p>
                Differenza di <strong>{money(currentBalance - account.current_balance, account.currency)}</strong>.
                Verrà registrata come rettifica di saldo, senza alterare entrate e uscite.
              </p>
            </div>
          ) : null}
          <label className="flex items-center gap-3 rounded-xl border p-3 text-sm">
            <input type="checkbox" className="size-4 accent-[hsl(var(--primary))]" {...form.register("include_in_liquidity")} />
            Includi nel calcolo della liquidità
          </label>
          <Field label="Note">
            <Textarea placeholder="Opzionali" {...form.register("notes")} />
          </Field>
          <Button disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="size-4 animate-spin" /> : null}
            {account ? "Salva e riconcilia" : "Crea conto"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
