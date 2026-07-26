"use client";

import { HandCoins, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useFinance } from "@/components/finance-provider";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import type { Receivable } from "@/lib/types";
import { money } from "@/lib/utils";

export function ReceivablePaymentDialog({ item }: { item: Receivable }) {
  const { accounts, recordReceivablePayment } = useFinance();
  const remaining = item.original_amount - item.received_amount;
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(remaining / 100);
  const eligible = accounts.filter((account) => account.currency === item.currency && account.type !== "credit_card");
  const [accountId, setAccountId] = useState(eligible[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  async function submit() {
    const value = Math.round(amount * 100);
    if (value <= 0 || value > remaining) return toast.error("Controlla l’importo");
    if (!accountId) return toast.error("Seleziona il conto di accredito");
    setSaving(true);
    try {
      await recordReceivablePayment(item.id, value, accountId, date);
      setOpen(false);
    } catch (error) {
      toast.error("Rimborso non registrato", { description: error instanceof Error ? error.message : "Riprova." });
    } finally { setSaving(false); }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><HandCoins className="size-3.5" /> Registra rimborso</Button></DialogTrigger>
      <DialogContent title="Rimborso ricevuto" description="Aumenta il saldo del conto e riduce il credito, senza essere contato come stipendio.">
        <div className="mb-4 rounded-xl bg-muted p-4 text-sm"><div className="flex justify-between"><span>Residuo</span><strong>{money(remaining, item.currency)}</strong></div></div>
        <div className="grid gap-4">
          <Field label="Importo ricevuto"><Input type="number" step="0.01" max={remaining / 100} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></Field>
          <Field label="Conto di accredito"><Select value={accountId} onChange={(event) => setAccountId(event.target.value)}><option value="">Seleziona…</option>{eligible.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</Select></Field>
          <Field label="Data"><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></Field>
          <Button onClick={submit} disabled={saving}>{saving ? <Loader2 className="size-4 animate-spin" /> : <HandCoins className="size-4" />}Registra incasso</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
