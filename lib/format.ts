export const formatMoney = (value: number, compact = false) =>
  new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: compact ? 0 : 2,
    maximumFractionDigits: compact ? 0 : 2,
  }).format(value);

export const formatDate = (iso: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en-IE", options ?? { day: "numeric", month: "short" }).format(
    new Date(`${iso}T12:00:00`),
  );

export const monthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

export const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));
