"use client";

import {
  Banknote,
  ChartNoAxesCombined,
  CreditCard,
  Landmark,
  MoreVertical,
  PiggyBank,
  Plus,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AccountDialog } from "@/components/accounts/account-dialog";
import { useFinance } from "@/components/finance-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { money } from "@/lib/utils";
import type { Account, AccountType } from "@/lib/types";

const accountIcons: Record<AccountType, typeof Landmark> = {
  checking: Landmark,
  cash: Banknote,
  savings: PiggyBank,
  investment: ChartNoAxesCombined,
  credit_card: CreditCard,
  tax: WalletCards,
};
const accountLabels: Record<AccountType, string> = {
  checking: "Conto corrente",
  cash: "Contanti",
  savings: "Deposito",
  investment: "Investimento",
  credit_card: "Carta di credito",
  tax: "Conto fiscale",
};

function DeleteAccount({ account }: { account: Account }) {
  const { removeAccount } = useFinance();
  const [open, setOpen] = useState(false);
  async function remove() {
    try {
      await removeAccount(account.id);
      setOpen(false);
    } catch (error) {
      toast.error("Il conto non può essere eliminato", { description: error instanceof Error ? error.message : "Potrebbe avere dati collegati." });
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-9 min-h-9 text-muted-foreground hover:text-destructive"
          aria-label={`Elimina ${account.name}`}
        >
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent title={`Eliminare ${account.name}?`} description="L’operazione è possibile solo se il conto non ha movimenti o dati collegati.">
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annulla</Button>
          <Button variant="destructive" className="flex-1" onClick={remove}>Elimina</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function AccountsPage() {
  const { accounts } = useFinance();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">I tuoi conti</h2>
          <p className="mt-1 text-sm text-muted-foreground">Saldi, liquidità e investimenti senza doppi conteggi.</p>
        </div>
        <AccountDialog>
          <Button><Plus className="size-4" /> Nuovo conto</Button>
        </AccountDialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {accounts.map((account) => {
          const Icon = accountIcons[account.type];
          return (
            <Card key={account.id} className="group">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div className="grid size-11 place-items-center rounded-xl bg-muted text-primary">
                    <Icon className="size-5" />
                  </div>
                  <div className="flex items-center">
                    <AccountDialog account={account}>
                      <Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground" aria-label={`Modifica ${account.name}`}>
                        <MoreVertical className="size-4" />
                      </Button>
                    </AccountDialog>
                    <DeleteAccount account={account} />
                  </div>
                </div>
                <p className="mt-5 text-sm font-semibold">{account.name}</p>
                <p className="mt-1 text-2xl font-semibold tracking-[-.03em]">{money(account.current_balance, account.currency)}</p>
                <div className="mt-5 flex items-center justify-between border-t pt-4">
                  <Badge>{accountLabels[account.type]}</Badge>
                  <span className="text-[11px] text-muted-foreground">
                    {account.include_in_liquidity ? "In liquidità" : "Fuori liquidità"}
                  </span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-muted/30 p-4 text-xs leading-relaxed text-muted-foreground">
        Il saldo di una carta di credito è mostrato come debito. Modificare manualmente un saldo genera una rettifica separata, non una falsa entrata o uscita.
      </div>
    </div>
  );
}
