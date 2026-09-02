import type { SalaryProfile } from "@/lib/types";

export const OVERTIME_TAX_RESERVE_PER_HOUR = 13;

export function overtimeTaxReserve(hours: number) {
  return Math.max(0, hours || 0) * OVERTIME_TAX_RESERVE_PER_HOUR;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function overtimeHoursForMonth(profiles: SalaryProfile[], year: number, month: number) {
  const key = monthKey(year, month);
  return profiles.reduce((total, profile) => {
    const saved = profile.monthlyOvertime?.[key];
    if (saved) return total + Math.max(0, saved.hours || 0);
    return total;
  }, 0);
}

export function overtimeTaxProjection(profiles: SalaryProfile[], year: number, today = new Date()) {
  const monthly = Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const hours = overtimeHoursForMonth(profiles, year, month);
    return { month, hours, reserve: overtimeTaxReserve(hours) };
  });
  const throughMonth = year < today.getFullYear() ? 12 : year > today.getFullYear() ? 0 : today.getMonth() + 1;
  return {
    monthly,
    projectedHours: monthly.reduce((sum, item) => sum + item.hours, 0),
    annualReserve: monthly.reduce((sum, item) => sum + item.reserve, 0),
    recommendedToDate: monthly.filter((item) => item.month <= throughMonth).reduce((sum, item) => sum + item.reserve, 0),
  };
}
