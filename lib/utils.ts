import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export type Currency = "EUR" | "CHF";

export function money(cents: number, currency: Currency = "EUR") {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  })
    .format(cents / 100)
    .replace(/\s/g, " ");
}

export function compactMoney(cents: number, currency: Currency = "EUR") {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    notation: Math.abs(cents) >= 100000 ? "compact" : "standard",
    maximumFractionDigits: Math.abs(cents) >= 100000 ? 1 : 2,
    useGrouping: true,
  })
    .format(cents / 100)
    .replace(/\s/g, " ");
}

export function cents(value: string | number) {
  if (typeof value === "number") return Math.round(value * 100);
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  return Math.round(Number(normalized) * 100);
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.max(0, Math.round((part / total) * 100)));
}
