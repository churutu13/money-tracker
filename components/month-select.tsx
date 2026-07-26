"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths, format, parseISO } from "date-fns";
import { it } from "date-fns/locale";
import { useFinance } from "@/components/finance-provider";
import { Button } from "@/components/ui/button";

export function MonthSelect() {
  const { selectedMonth, setSelectedMonth } = useFinance();
  const value = parseISO(selectedMonth);
  const move = (amount: number) => setSelectedMonth(format(addMonths(value, amount), "yyyy-MM-01"));
  return (
    <div className="flex w-full items-center justify-between rounded-xl border bg-card p-1 sm:w-auto">
      <Button variant="ghost" size="icon" className="size-9 min-h-9" onClick={() => move(-1)} aria-label="Mese precedente">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="min-w-32 px-2 text-center text-sm font-semibold capitalize">
        {format(value, "MMMM yyyy", { locale: it })}
      </span>
      <Button variant="ghost" size="icon" className="size-9 min-h-9" onClick={() => move(1)} aria-label="Mese successivo">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
