"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/research", label: "Research" },
  { href: "/strategies", label: "Strategie" },
  { href: "/backtests", label: "Backtest" },
  { href: "/signals", label: "Segnali" },
  { href: "/orders", label: "Ordini" },
  { href: "/journal", label: "Journal" },
  { href: "/execution", label: "Esecuzione" },
  { href: "/reports", label: "Report" },
  { href: "/autopilot", label: "Autopilot" },
  { href: "/settings", label: "Impostazioni" },
];

export function NavLinks() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            pathname === link.href
              ? "bg-blue-600/20 text-blue-300"
              : "text-slate-400 hover:bg-slate-800 hover:text-white",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
