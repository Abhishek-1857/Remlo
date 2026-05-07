"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
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
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });
  }, []);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const title =
    Object.entries(pageTitles).find(([path]) =>
      pathname.startsWith(path)
    )?.[1] || "Remlo";

  const initials = userEmail?.[0]?.toUpperCase() ?? "?";

  return (
    <ToastProvider>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div
        className="min-h-screen relative z-[1] transition-[margin] duration-300"
        style={{ marginLeft: collapsed ? "64px" : "200px" }}
      >
        <header className="h-14 flex items-center justify-between px-8 backdrop-blur-sm sticky top-0 z-10" style={{ borderBottom: "1px solid rgba(0,230,160,0.15)", background: "rgba(8,12,20,0.85)" }}>
          <h1 className="font-heading font-semibold text-xl text-[var(--text-primary)]">
            {title}
          </h1>
          <div className="flex items-center gap-3">
            <TestBadge />

            {/* User dropdown */}
            {userEmail && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-full text-sm font-medium transition-all"
                  style={{
                    background: dropdownOpen ? 'rgba(0,230,160,0.12)' : 'rgba(0,230,160,0.07)',
                    border: '1px solid rgba(0,230,160,0.25)',
                    color: 'var(--green)',
                  }}
                >
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                    style={{ background: 'var(--green)', color: '#080C14' }}
                  >
                    {initials}
                  </span>
                  <span className="hidden sm:block text-[11px] font-mono-data max-w-[140px] truncate" style={{ color: 'var(--text-secondary)' }}>
                    {userEmail}
                  </span>
                  <svg
                    width="11" height="11" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className="flex-shrink-0 transition-transform duration-200"
                    style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {dropdownOpen && (
                  <div
                    className="absolute right-0 top-full mt-2 w-64 rounded-2xl overflow-hidden z-50 animate-fade-in"
                    style={{
                      background: 'rgba(8,12,20,0.97)',
                      border: '1px solid rgba(0,230,160,0.2)',
                      backdropFilter: 'blur(24px)',
                      boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 20px rgba(0,230,160,0.05)',
                    }}
                  >
                    {/* User header */}
                    <div className="px-4 pt-4 pb-3 border-b border-[rgba(255,255,255,0.06)]">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                          style={{ background: 'linear-gradient(135deg, var(--green-light), var(--green))', color: '#080C14' }}
                        >
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[var(--text-primary)] truncate">{userEmail}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="w-1.5 h-1.5 rounded-full animate-pulse-slow" style={{ background: '#00E6A0' }} />
                            <span className="text-[10px] font-mono-data" style={{ color: '#00E6A0' }}>Active · Devnet</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="p-2">
                      <div className="h-px mx-2 mb-2" style={{ background: 'rgba(255,255,255,0.06)' }} />
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm transition-colors"
                        style={{ color: 'var(--red)' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--red-dim)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                        Sign out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </header>
        <main className="p-8">{children}</main>
      </div>
    </ToastProvider>
  );
}
