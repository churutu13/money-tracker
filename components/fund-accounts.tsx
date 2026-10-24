"use client";

import { useState } from "react";
import { Building2, ChevronDown, PiggyBank, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { TaxReserveAccount } from "./tax-reserve-account";
import { useFlow } from "@/components/app-provider";
import { useConfirm } from "@/components/confirm-provider";
import { NumberInput } from "@/components/number-input";
import { loanTotals, loanSchedule } from "@/lib/loans";
import Link from "next/link";
import { formatMoney } from "@/lib/format";
import type { Fund } from "@/lib/types";

export function FundAccounts({ fund, variant = "home" }: { fund: Fund; variant?: "home" | "settings" }) {
  const { data, updateFundAccount, addFundAccount, deleteFundAccount } = useFlow();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const settings = variant === "settings";
  const accounts = fund.accounts ?? [];

  return (
    <div className={settings ? `settings-fund-accounts ${fund.kind}` : `fund-accounts ${open ? "open" : ""}`} id={settings ? `accounts-${fund.id}` : undefined}>
      {(data.loans ?? []).some(l => l.linkedFundId === fund.id) && <div className="loan-notice"><Link href="/loans">Capitale prestato collegato</Link><p>Liquidità effettiva: {formatMoney(fund.balance)}</p>{(data.loans ?? []).filter(l => l.linkedFundId === fund.id).map(l => <div key={l.id}><strong>{l.person}: {formatMoney(l.type === "given" ? loanTotals(data,l.id).residual : 0)}</strong><small>Rientri attesi: {loanSchedule(data,l).filter(p => p.kind === "repayment").map(p => `${p.date}: ${formatMoney(p.amount)}`).join(" · ") || "Da quantificare"}</small></div>)}<small>Il capitale prestato non è disponibile per le scadenze.</small></div>}
      {settings ? <header className="settings-accounts-heading">
        {fund.kind === "tax" ? <ShieldCheck size={19} /> : <PiggyBank size={19} />}
        <div><strong>{fund.name} accounts</strong><small>Balances held in {fund.name}</small></div>
        <strong>{formatMoney(fund.balance)}</strong>
      </header> : (
      <button className="fund-accounts-tab" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span><Building2 size={14} /> Accounts</span>
        <small>{accounts.length ? `${accounts.length} · ${formatMoney(fund.balance, true)}` : "Add account"}</small>
        <ChevronDown size={15} />
      </button>)}
      {settings || open ? (
        <div className="fund-account-list reveal">
          {settings && !accounts.length ? <p className="settings-accounts-empty">No accounts in {fund.name} yet.</p> : null}
          {accounts.map((account) => (
            <div className="fund-account-group" key={account.id}>
              <div className="fund-account-row">
                <input
                  value={account.name}
                  onChange={(event) => updateFundAccount(fund.id, { ...account, name: event.target.value })}
                  aria-label={`${fund.name} account name`}
                  placeholder="Account name"
                />
                <label><span>€</span><NumberInput value={account.balance} readOnly={Boolean(account.taxReserveTracking)} title={account.taxReserveTracking ? "Disponibilità reale: modifica il teorico e il prestito nel riepilogo sotto." : undefined} step="0.01" onValueChange={(value) => { if (value !== undefined) updateFundAccount(fund.id, { ...account, balance: value }); }} aria-label={`${account.name} balance`} /></label>
                <button type="button" onClick={async () => {
                  const approved = await confirm({ title: "Delete account?", message: `“${account.name}” will be removed from ${fund.name}.`, confirmLabel: "Delete", danger: true });
                  if (approved) deleteFundAccount(fund.id, account.id);
                }} aria-label={`Delete ${account.name}`}><Trash2 size={14} /></button>
              </div>
              {fund.kind === "tax" && <TaxReserveAccount fundId={fund.id} account={account} editable={settings} />}
            </div>
          ))}
          <button className="add-account-button" type="button" onClick={() => addFundAccount(fund.id, { id: crypto.randomUUID(), name: "New account", balance: 0 })}>
            <Plus size={14} /> {settings ? `Add ${fund.name} account` : "Add account"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
