"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { TestBadge } from "@/components/test-banner";
import { ToastProvider } from "@/components/toast";
import { createClient } from "@/lib/supabase/browser";

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/contractors": "Contractors",
  "/bulk-payout": "Bulk Payout",
  "/payouts": "Payout History",
  "/pay": "Send Payment",
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  const title =
    Object.entries(pageTitles).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] || "FlashPay";

  return (
    <ToastProvider>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className="min-h-screen relative z-[1] transition-[margin] duration-300"
        style={{ marginLeft: collapsed ? "64px" : "200px" }}
      >
        <header className="h-14 border-b border-[var(--border)] flex items-center justify-between px-8 bg-[var(--bg-base)]/80 backdrop-blur-sm sticky top-0 z-10">
          <h1 className="font-heading font-semibold text-xl text-[var(--text-primary)]">
            {title}
          </h1>
          <div className="flex items-center gap-3">
            {userEmail && (
              <span className="text-[11px] text-[var(--text-muted)] font-mono-data hidden sm:block truncate max-w-[180px]">{userEmail}</span>
            )}
            <TestBadge />
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
