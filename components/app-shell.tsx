"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  CircleUserRound,
  CreditCard,
  LayoutDashboard,
  Moon,
  MoreHorizontal,
  PiggyBank,
  Plus,
  ReceiptText,
  Repeat2,
  Sun,
  WalletCards,
} from "lucide-react";
import { useTheme } from "next-themes";
import type { ReactNode } from "react";
import { useFinance } from "@/components/finance-provider";
import { TransactionDialog } from "@/components/transactions/transaction-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { LoginScreen } from "@/components/auth/login-screen";

const primaryNav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/budget", label: "Budget", icon: ReceiptText },
  { href: "/movimenti", label: "Movimenti", icon: ArrowLeftRight },
  { href: "/patrimonio", label: "Patrimonio", icon: ChartNoAxesCombined },
  { href: "/altro", label: "Altro", icon: MoreHorizontal },
];

const desktopExtra = [
  { href: "/conti", label: "Conti", icon: WalletCards },
  { href: "/ricorrenti", label: "Ricorrenti", icon: Repeat2 },
  { href: "/tasse", label: "Tasse", icon: PiggyBank },
  { href: "/crediti", label: "Crediti", icon: CircleUserRound },
  { href: "/amex", label: "Amex", icon: CreditCard },
];

const pageNames: Record<string, string> = {
  "/": "Panoramica",
  "/budget": "Budget",
  "/movimenti": "Movimenti",
  "/patrimonio": "Patrimonio",
  "/conti": "Conti",
  "/ricorrenti": "Spese ricorrenti",
  "/tasse": "Tasse",
  "/crediti": "Crediti",
  "/amex": "Carta Amex",
  "/altro": "Altro",
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { authLoading, user, demoMode } = useFinance();

  if (authLoading) {
    return (
      <div className="grid min-h-dvh place-items-center p-6">
        <div className="w-full max-w-sm space-y-4">
          <Skeleton className="mx-auto size-14 rounded-2xl" />
          <Skeleton className="mx-auto h-8 w-44" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    );
  }

  if (!demoMode && !user) return <LoginScreen />;

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[252px_1fr]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[252px] flex-col border-r bg-card md:flex">
        <Link href="/" className="flex h-20 items-center gap-3 px-6">
          <span className="grid size-10 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">D</span>
          <span>
            <strong className="block text-lg leading-none tracking-tight">Denaro</strong>
            <span className="mt-1 block text-[11px] font-medium text-muted-foreground">FINANZE PERSONALI</span>
          </span>
        </Link>
        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-3">
          {[...primaryNav.slice(0, 4), ...desktopExtra].map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="size-4.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <button
            className="flex w-full items-center justify-between rounded-xl p-2 text-sm text-muted-foreground hover:bg-muted"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            <span className="flex items-center gap-3">
              <Sun className="size-4 dark:hidden" />
              <Moon className="hidden size-4 dark:block" />
              Aspetto
            </span>
            <span className="text-xs">Tema</span>
          </button>
        </div>
      </aside>

      <div className="min-w-0 md:col-start-2">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background/95 px-4 backdrop-blur md:h-20 md:px-8">
          <div>
            <p className="hidden text-xs font-medium uppercase tracking-[.15em] text-muted-foreground md:block">Il tuo spazio</p>
            <h1 className="text-lg font-semibold tracking-tight md:text-2xl">{pageNames[pathname] ?? "Denaro"}</h1>
          </div>
          <div className="flex items-center gap-2">
            {demoMode ? (
              <span className="hidden rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-700 sm:inline dark:text-amber-400">
                Modalità demo
              </span>
            ) : null}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              aria-label="Cambia tema"
            >
              <Sun className="size-5 dark:hidden" />
              <Moon className="hidden size-5 dark:block" />
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-5 pb-28 md:px-8 md:py-8 md:pb-10">
          {children}
        </main>
      </div>

      <TransactionDialog>
        <button
          className="fixed bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-4 z-40 grid size-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-xl transition-transform active:scale-95 md:bottom-8 md:right-8"
          aria-label="Aggiungi movimento"
        >
          <Plus className="size-6" />
        </button>
      </TransactionDialog>

      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-card/95 px-1 pt-2 backdrop-blur md:hidden">
        {primaryNav.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href || (item.href === "/altro" && desktopExtra.some((extra) => pathname === extra.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1 rounded-lg px-1 py-1.5 text-[10px] font-semibold",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("size-5", active && "stroke-[2.5]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
