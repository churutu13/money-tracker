"use client";

import { useState } from "react";
import { Building2, ChevronDown, Plus, Trash2 } from "lucide-react";
import { useFlow } from "@/components/app-provider";
import { useConfirm } from "@/components/confirm-provider";
import { NumberInput } from "@/components/number-input";
import { formatMoney } from "@/lib/format";
import type { Fund } from "@/lib/types";

export function FundAccounts({ fund }: { fund: Fund }) {
  const { updateFundAccount, addFundAccount, deleteFundAccount } = useFlow();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const accounts = fund.accounts ?? [];

  return (
    <div className={`fund-accounts ${open ? "open" : ""}`}>
      <button className="fund-accounts-tab" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <span><Building2 size={14} /> Accounts</span>
        <small>{accounts.length ? `${accounts.length} · ${formatMoney(fund.balance, true)}` : "Add account"}</small>
        <ChevronDown size={15} />
      </button>
      {open ? (
        <div className="fund-account-list reveal">
          {accounts.map((account) => (
            <div className="fund-account-row" key={account.id}>
              <input
                value={account.name}
                onChange={(event) => updateFundAccount(fund.id, { ...account, name: event.target.value })}
                aria-label={`${fund.name} account name`}
                placeholder="Account name"
              />
              <label><span>€</span><NumberInput value={account.balance} step="0.01" onValueChange={(value) => { if (value !== undefined) updateFundAccount(fund.id, { ...account, balance: value }); }} aria-label={`${account.name} balance`} /></label>
              <button type="button" onClick={async () => {
                const approved = await confirm({ title: "Delete account?", message: `“${account.name}” will be removed from ${fund.name}.`, confirmLabel: "Delete", danger: true });
                if (approved) deleteFundAccount(fund.id, account.id);
              }} aria-label={`Delete ${account.name}`}><Trash2 size={14} /></button>
            </div>
          ))}
          <button className="add-account-button" type="button" onClick={() => addFundAccount(fund.id, { id: crypto.randomUUID(), name: "New account", balance: 0 })}>
            <Plus size={14} /> Add account
          </button>
        </div>
      ) : null}
    </div>
  );
}
