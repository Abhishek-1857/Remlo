"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { RemloLogo, RemloWordmark } from "@/components/logo";

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

  return (
    <aside
      className="fixed left-0 top-0 bottom-0 bg-[var(--bg-surface)] flex flex-col z-40 transition-[width] duration-300 overflow-hidden"
      style={{ width: collapsed ? "64px" : "200px", borderRight: "1px solid rgba(0,230,160,0.15)" }}
    >
      {/* Gradient top accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] z-10" style={{ background: 'linear-gradient(90deg, #00E6A0 0%, rgba(0,230,160,0.3) 60%, transparent 100%)' }} />
      {/* Logo */}
      <div className="flex items-center h-14 flex-shrink-0 px-3" style={{ borderBottom: "1px solid rgba(0,230,160,0.15)" }}>
        <Link href="/dashboard" className="flex items-center gap-2.5 flex-shrink-0">
          <RemloLogo size={28} />
          {!collapsed && <RemloWordmark className="text-[15px] whitespace-nowrap" />}
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
                <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r bg-[var(--green)]" style={{ boxShadow: '2px 0 8px rgba(0,230,160,0.5)' }} />
              )}
              {item.icon}
              {!collapsed && <span className="font-medium whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Status footer */}
      <div className="px-3 py-2.5" style={{ borderTop: "1px solid rgba(0,230,160,0.15)" }}>
        {collapsed ? (
          <div className="flex justify-center" title="Solana: Operational">
            <span className="w-2 h-2 rounded-full animate-pulse-slow" style={{ background: "#00E6A0" }} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse-slow" style={{ background: "#00E6A0" }} />
              <span className="text-[10px] font-medium" style={{ color: "#00E6A0" }}>Solana: Operational</span>
            </div>
            <p className="text-[9px] text-[var(--text-muted)] leading-tight">Powered by Dodo Payments</p>
          </>
        )}
      </div>

    </aside>
  );
}
