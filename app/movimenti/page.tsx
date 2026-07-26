"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Pencil,
  Search,
  SlidersHorizontal,
  Trash2,
  WalletCards,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useFinance } from "@/components/finance-provider";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input, Select } from "@/components/ui/input";
import type { Transaction, TransactionType } from "@/lib/types";
import { cn, money } from "@/lib/utils";

const typeLabels: Record<TransactionType, string> = {
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

function DeleteTransaction({ transaction }: { transaction: Transaction }) {
  const { removeTransaction } = useFinance();
  const [open, setOpen] = useState(false);
  async function remove() {
    try {
      await removeTransaction(transaction.id);
      setOpen(false);
    } catch (error) {
      toast.error("Eliminazione non riuscita", { description: error instanceof Error ? error.message : "Riprova." });
    }
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground hover:text-destructive" aria-label="Elimina movimento">
          <Trash2 className="size-4" />
        </Button>
      </DialogTrigger>
      <DialogContent title="Eliminare il movimento?" description="Il saldo dei conti collegati verrà ricalcolato automaticamente.">
        <div className="rounded-xl bg-muted p-4">
          <p className="text-sm font-semibold">{transaction.description}</p>
          <p className="mt-1 text-sm text-muted-foreground">{money(transaction.amount, transaction.currency)}</p>
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>Annulla</Button>
          <Button variant="destructive" className="flex-1" onClick={remove}>Elimina</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function TransactionsPage() {
  const { transactions, accounts } = useFinance();
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState("all");
  const [type, setType] = useState("all");
  const [account, setAccount] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filtered = useMemo(
    () =>
      transactions.filter((tx) => {
        const matchesQuery = `${tx.description} ${tx.person ?? ""} ${tx.notes ?? ""}`.toLowerCase().includes(query.toLowerCase());
        const matchesCurrency = currency === "all" || tx.currency === currency;
        const matchesType = type === "all" || tx.type === type;
        const matchesAccount = account === "all" || tx.source_account_id === account || tx.destination_account_id === account;
        return matchesQuery && matchesCurrency && matchesType && matchesAccount;
      }),
    [transactions, query, currency, type, account]
  );

  const accountName = (id?: string | null) => accounts.find((item) => item.id === id)?.name;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Tutti i movimenti</h2>
          <p className="mt-1 text-sm text-muted-foreground">Trasferimenti esclusi da entrate e uscite.</p>
        </div>
        <TransactionDialog>
          <Button><ArrowLeftRight className="size-4" /> Registra</Button>
        </TransactionDialog>
      </div>

      <Card>
        <CardContent className="p-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3.5 size-4 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca descrizione, persona o nota…" />
            </div>
            <Button variant="outline" size="icon" onClick={() => setFiltersOpen((value) => !value)} aria-label="Mostra filtri">
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>
          {filtersOpen ? (
            <div className="mt-3 grid gap-2 border-t pt-3 sm:grid-cols-3">
              <Select value={currency} onChange={(event) => setCurrency(event.target.value)} aria-label="Filtra valuta">
                <option value="all">Tutte le valute</option>
                <option value="EUR">EUR</option>
                <option value="CHF">CHF</option>
              </Select>
              <Select value={type} onChange={(event) => setType(event.target.value)} aria-label="Filtra tipo">
                <option value="all">Tutti i tipi</option>
                {Object.entries(typeLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </Select>
              <Select value={account} onChange={(event) => setAccount(event.target.value)} aria-label="Filtra conto">
                <option value="all">Tutti i conti</option>
                {accounts.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </Select>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {filtered.length === 0 ? (
        <EmptyState icon={WalletCards} title="Nessun movimento" description="Modifica i filtri oppure registra il tuo primo movimento." />
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y">
            {filtered.map((tx) => {
              const isIncome = ["income", "refund_received", "disinvestment"].includes(tx.type);
              const isTransfer = ["transfer", "allocation", "investment", "credit_card_payment"].includes(tx.type);
              const Icon = isTransfer ? ArrowLeftRight : isIncome ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={tx.id} className="flex items-center gap-3 p-3 sm:p-4">
                  <div
                    className={cn(
                      "grid size-10 shrink-0 place-items-center rounded-xl",
                      isTransfer ? "bg-blue-500/10 text-blue-600" : isIncome ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">{tx.description}</p>
                      {tx.credit_card_id ? <Badge tone="info">Amex</Badge> : null}
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {format(parseISO(tx.transaction_date), "d MMM yyyy", { locale: it })}
                      {" · "}
                      {tx.type === "transfer"
                        ? `${accountName(tx.source_account_id) ?? "—"} → ${accountName(tx.destination_account_id) ?? "—"}`
                        : accountName(tx.source_account_id) ?? accountName(tx.destination_account_id) ?? typeLabels[tx.type]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={cn("text-sm font-semibold", isIncome && "text-emerald-600", isTransfer && "text-foreground")}>
                      {isIncome ? "+" : isTransfer ? "" : "−"}{money(tx.amount, tx.currency)}
                    </p>
                    <p className="mt-1 hidden text-[10px] text-muted-foreground sm:block">{typeLabels[tx.type]}</p>
                  </div>
                  <div className="flex">
                    <TransactionDialog transaction={tx}>
                      <Button variant="ghost" size="icon" className="size-9 min-h-9 text-muted-foreground" aria-label="Modifica movimento">
                        <Pencil className="size-4" />
                      </Button>
                    </TransactionDialog>
                    <DeleteTransaction transaction={tx} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
