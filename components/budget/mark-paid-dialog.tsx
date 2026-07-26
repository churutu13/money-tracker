"use client";

import { Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useFinance } from "@/components/finance-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import type { BudgetItem } from "@/lib/types";
import { money } from "@/lib/utils";

export function MarkPaidDialog({ item }: { item: BudgetItem }) {
  const { accounts, markBudgetPaid } = useFinance();
  const eligible = accounts.filter((account) => account.currency === item.currency);
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState(item.account_id ?? eligible[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!accountId) return toast.error("Seleziona un conto");
    setSaving(true);
    try {
      await markBudgetPaid(item.id, accountId, date);
      setOpen(false);
    } catch (error) {
      toast.error("Pagamento non registrato", { description: error instanceof Error ? error.message : "Riprova." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Check className="size-3.5" /> Segna pagato</Button>
      </DialogTrigger>
      <DialogContent title="Conferma pagamento" description="Verrà creato un solo movimento collegato e il saldo verrà aggiornato.">
        <div className="mb-4 rounded-xl bg-muted p-4">
          <div className="flex items-center justify-between">
            <strong className="text-sm">{item.name}</strong>
            <strong>{money(item.amount, item.currency)}</strong>
          </div>
        </div>
        <div className="grid gap-4">
          <Field label="Conto o carta utilizzata">
            <Select value={accountId} onChange={(event) => setAccountId(event.target.value)}>
              <option value="">Seleziona…</option>
              {eligible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
            </Select>
          </Field>
          <Field label="Data effettiva">
            <Input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
            Registra pagamento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
