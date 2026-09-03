export function compareMonths(left: string, right: string) {
  return left.localeCompare(right);
}

export function addMonths(month: string, amount: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + amount, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthRange(startMonth: string, endMonth: string) {
  const months: string[] = [];
  for (let month = startMonth; compareMonths(month, endMonth) <= 0; month = addMonths(month, 1)) months.push(month);
  return months;
}

export function monthLabel(month: string, options?: Intl.DateTimeFormatOptions) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IE", options ?? { month: "short", year: "numeric" }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

export function yearOf(month: string) {
  return Number(month.slice(0, 4));
}
