"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PayzapLogo, PayzapWordmark } from "@/components/logo";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/payouts",
    label: "Payouts",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    ),
  },
  {
    href: "/contractors",
    label: "Contractors",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/bulk-payout",
    label: "Bulk Payout",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
        <line x1="12" y1="12" x2="12" y2="16" />
        <line x1="10" y1="14" x2="14" y2="14" />
      </svg>
    ),
  },
  {
    href: "/scheduled-payouts",
    label: "Scheduled",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <circle cx="12" cy="15" r="1" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/treasury",
    label: "Treasury",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
        <path d="M16 3H8a2 2 0 0 0-2 2v2" />
        <circle cx="18" cy="14" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    href: "/pay",
    label: "Send Payment",
    matchPath: "/pay",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="22" y1="2" x2="11" y2="13" />
        <polygon points="22 2 15 22 11 13 2 9 22 2" />
      </svg>
    ),
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const [scheduledDueCount, setScheduledDueCount] = useState(0);
  const [blockHeight, setBlockHeight] = useState<number | null>(null);
  const [slotTime, setSlotTime] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/scheduled-payouts")
      .then((r) => r.ok ? r.json() : [])
      .then((data: { status: string; next_due_date: string }[]) => {
        if (!Array.isArray(data)) return;
        const today = new Date().toISOString().split("T")[0];
        setScheduledDueCount(
          data.filter((s) => s.status === "active" && s.next_due_date <= today).length
        );
      })
      .catch(() => {});
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function fetchBlock() {
      try {
        const rpcUrl = "https://api.devnet.solana.com";
        const t0 = performance.now();
        const res = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBlockHeight" }),
        });
        const ms = Math.round(performance.now() - t0);
        const json = await res.json();
        if (!cancelled && json.result) {
          setBlockHeight(json.result);
          setSlotTime(ms);
        }
      } catch { /* ignore */ }
    }
    fetchBlock();
    const iv = setInterval(fetchBlock, 30000);
    return () => { cancelled = true; clearInterval(iv); };
  }, []);

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 bg-[var(--bg-surface)] flex flex-col z-40 transition-[width] duration-300 overflow-hidden"
      style={{ width: collapsed ? "64px" : "200px", borderRight: "1px solid var(--sidebar-border)" }}
    >
      {/* Gradient top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: 'var(--sidebar-accent)' }} />
      {/* Logo */}
      <div className="flex items-center h-14 flex-shrink-0 px-3" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
          <PayzapLogo size={28} />
          {!collapsed && <PayzapWordmark className="text-[15px] whitespace-nowrap" />}
        </Link>
        <button
          onClick={onToggle}
          className="ml-auto flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-2 py-3 flex-1">
        {navItems.map((item) => {
          const isActive = item.matchPath
            ? pathname === item.matchPath || pathname.startsWith(item.matchPath + "/")
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.label}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`relative flex items-center gap-2.5 rounded-md text-sm transition-colors ${
                collapsed ? "px-0 py-2.5 justify-center" : "px-3 py-2.5"
              } ${
                isActive
                  ? "bg-[var(--green-dim)] text-[var(--green)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              {isActive && !collapsed && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-[var(--green)]" style={{ boxShadow: '2px 0 8px var(--green-dim)' }} />
              )}
              {item.icon}
              {!collapsed && (
                <>
                  <span className="font-medium whitespace-nowrap">{item.label}</span>
                  {item.href === "/scheduled-payouts" && scheduledDueCount > 0 && (
                    <span
                      className="ml-auto text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full"
                      style={{ background: "var(--green)", color: "var(--bg-base)" }}
                    >
                      {scheduledDueCount}
                    </span>
                  )}
                </>
              )}
              {collapsed && item.href === "/scheduled-payouts" && scheduledDueCount > 0 && (
                <span
                  className="absolute top-1 right-1 w-2 h-2 rounded-full"
                  style={{ background: "var(--green)" }}
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="px-3 py-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
        {collapsed ? (
          <div className="flex justify-center" title="Solana: Operational">
            <span className="w-2 h-2 rounded-full animate-pulse-slow" style={{ background: "var(--green)" }} />
          </div>
        ) : (
          <div
            className="rounded-lg px-3 py-2.5"
            style={{
              border: "1px solid var(--border)",
              background: "var(--bg-surface)",
            }}
          >
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse-slow" style={{ background: "var(--green)" }} />
              <span className="text-[11px] font-semibold" style={{ color: "var(--text-primary)" }}>Solana: Operational</span>
            </div>
            <p className="text-[9px] font-mono-data mb-1" style={{ color: "var(--text-muted)" }}>
              {blockHeight ? `Block ${blockHeight.toLocaleString()}` : "Devnet"} · {slotTime ? `${slotTime} ms` : "~400 ms"}
            </p>
            <p className="text-[8px] uppercase tracking-[0.1em] font-semibold" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
              Powered by Dodo Payments
            </p>
          </div>
        )}
      </div>

    </aside>
  );
}
