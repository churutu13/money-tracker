"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Calculator, CircleDollarSign, CreditCard, House, Plus, ReceiptText, Settings } from "lucide-react";
import { useFlow } from "./app-provider";
import { TransactionSheet } from "./transaction-sheet";

const links = [
  { href: "/", label: "Home", icon: House },
  { href: "/transactions", label: "Transactions", icon: ReceiptText },
  { href: "/frontax", label: "Frontax", icon: Calculator },
  { href: "/amex", label: "Amex", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { openTransactionSheet } = useFlow();
  return (
    <div className="app-frame">
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="Flow home">
          <span className="brand-mark"><CircleDollarSign size={22} strokeWidth={1.8} /></span>
          <span>Flow</span>
        </Link>
        <nav className="side-nav" aria-label="Primary navigation">
          {links.map(({ href, label, icon: Icon }) => {
            const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
            return (
              <Link key={href} href={href} className={`nav-link ${active ? "active" : ""}`}>
                <Icon size={19} strokeWidth={1.8} />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="privacy-note">
          <span className="status-dot" />
          Your data stays private
        </div>
      </aside>

      <main className="main-content">{children}</main>

      <button className="fab" onClick={() => openTransactionSheet(undefined, pathname.startsWith("/amex") ? "amex" : "default")} aria-label={pathname.startsWith("/amex") ? "Add Amex expense" : "Add transaction"} data-testid="add-transaction">
        <Plus size={28} strokeWidth={2} />
      </button>

      <nav className="bottom-nav" aria-label="Primary navigation">
        {links.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link key={href} href={href} className={active ? "active" : ""}>
              <Icon size={21} strokeWidth={active ? 2.2 : 1.7} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <TransactionSheet />
    </div>
  );
}
