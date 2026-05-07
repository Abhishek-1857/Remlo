"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Contractor {
  id: string;
  name: string;
  email: string | null;
  solana_wallet: string;
}

interface PayoutFull {
  id: string;
  contractor_id: string;
  amount_usd: number;
  status: string;
  created_at: string;
  contractors?: { name: string } | null;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function truncateWallet(w: string) {
  return `${w.slice(0, 6)}...${w.slice(-6)}`;
}

function daysAgo(dateStr: string) {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  if (d === 0) return "today";
  if (d === 1) return "1d ago";
  return `${d}d ago`;
}

function nameAccentColor(name: string): string {
  const colors = ["#00E6A0", "#638FFF", "#9B6DFF", "#33C9C9"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
}

export default function SendPaymentPage() {
  const router = useRouter();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [allPayouts, setAllPayouts] = useState<PayoutFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    Promise.all([
      fetch("/api/contractors").then((r) => r.json()),
      fetch("/api/payouts").then((r) => r.json()),
    ]).then(([cs, ps]) => {
      setContractors(cs);
      setAllPayouts(ps as PayoutFull[]);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = useMemo(() =>
    contractors.filter((c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email || "").toLowerCase().includes(search.toLowerCase())
    ), [contractors, search]);

  useEffect(() => { setFocusedIndex(-1); }, [search]);

  const donePaidPayouts = useMemo(() =>
    [...allPayouts.filter(p => p.status === "done")].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ), [allPayouts]);

  const totalPaidMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of allPayouts) {
      if (p.status === "done") map[p.contractor_id] = (map[p.contractor_id] || 0) + Number(p.amount_usd);
    }
    return map;
  }, [allPayouts]);

  const totalPaidAll = useMemo(() => Object.values(totalPaidMap).reduce((s, v) => s + v, 0), [totalPaidMap]);

  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return donePaidPayouts
      .filter(p => {
        const d = new Date(p.created_at);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((s, p) => s + Number(p.amount_usd), 0);
  }, [donePaidPayouts]);

  const avgPayout = donePaidPayouts.length > 0 ? totalPaidAll / donePaidPayouts.length : 0;
  const lastPayoutItem = donePaidPayouts[0] ?? null;

  const mostPaidContractor = useMemo(() => {
    const top = Object.entries(totalPaidMap).sort((a, b) => b[1] - a[1])[0];
    return top ? contractors.find(c => c.id === top[0]) ?? null : null;
  }, [totalPaidMap, contractors]);

  const recentPayouts = donePaidPayouts.slice(0, 3);

  const handleSelect = useCallback((id: string) => {
    router.push(`/pay/${id}`);
  }, [router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0 && filtered[focusedIndex]) {
      handleSelect(filtered[focusedIndex].id);
    } else if (e.key === "Escape") {
      setSearch("");
    }
  }, [filtered, focusedIndex, handleSelect]);

  return (
    <div className="animate-fade-in relative z-[1] w-full" onKeyDown={handleKeyDown}>
      {/* Dot grid texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #0E1420 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.4,
          zIndex: 0,
        }}
      />
      {/* Top-right glow orb */}
      <div
        className="fixed pointer-events-none"
        style={{
          top: "-100px", right: "-100px",
          width: "400px", height: "400px",
          background: "radial-gradient(circle, rgba(0,230,160,0.06) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      <div className="flex gap-8 items-start">
        {/* ── LEFT COLUMN (60%) ── */}
        <div className="flex-[3] min-w-0">
          <p className="text-sm text-[var(--text-muted)] mb-4">
            Choose who you&apos;re paying. You&apos;ll set the amount on the next step.
          </p>

          {!loading && contractors.length > 0 && (
            <p className="text-xs font-mono-data mb-4" style={{ color: "var(--text-muted)" }}>
              {contractors.length} contractor{contractors.length !== 1 ? "s" : ""} · ${totalPaidAll.toFixed(2)} total paid out
            </p>
          )}

          {/* Search */}
          <div className="relative mb-2">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-9 py-2.5 text-sm input-base search-glow"
              autoFocus
            />
            {search && (
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                style={{ color: "var(--text-muted)" }}
                onClick={() => setSearch("")}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>

          <p className="text-[11px] mb-5 font-mono-data" style={{ color: "#3A4A66" }}>
            ↑↓ navigate · Enter to select · Esc to clear
          </p>

          {/* Contractor list */}
          {loading ? (
            <div className="py-20 text-center text-[var(--text-muted)]">Loading...</div>
          ) : filtered.length === 0 ? (
            <div className="py-20 text-center">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40">
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <p className="text-sm text-[var(--text-muted)] mb-3">
                {search ? `No contractors match "${search}"` : "No contractors yet."}
              </p>
              {search ? (
                <button onClick={() => setSearch("")} className="text-sm text-[var(--green)] hover:underline">Clear search</button>
              ) : (
                <button onClick={() => router.push("/contractors")} className="text-sm text-[var(--green)] hover:underline">Add a contractor first →</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((c, idx) => {
                const initials = getInitials(c.name);
                const totalPaid = totalPaidMap[c.id] || 0;
                const isFocused = focusedIndex === idx;
                const accentColor = nameAccentColor(c.name);
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelect(c.id)}
                    onMouseEnter={() => setFocusedIndex(idx)}
                    className="w-full card text-left relative overflow-hidden flex items-center transition-all duration-150"
                    style={{
                      padding: "16px 16px 16px 20px",
                      minHeight: "80px",
                      gap: "16px",
                      background: isFocused
                        ? "linear-gradient(90deg, rgba(0,230,160,0.04) 0%, #0F1525 100%)"
                        : "linear-gradient(90deg, #0C1322 0%, #080C14 100%)",
                    }}
                  >
                    {/* Left accent bar */}
                    <div
                      className="absolute left-0 top-0 bottom-0 transition-all duration-150"
                      style={{ width: isFocused ? "5px" : "3px", background: accentColor }}
                    />

                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: `linear-gradient(135deg, ${accentColor}66, ${accentColor})` }}
                    >
                      <span className="text-sm font-bold" style={{ color: "#080C14" }}>{initials}</span>
                    </div>

                    {/* Name + email + wallet */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[14px] text-[var(--text-primary)] truncate">{c.name}</p>
                      {c.email && (
                        <p className="text-[12px] text-[var(--text-muted)] truncate mt-0.5">{c.email}</p>
                      )}
                      <p className="text-[11px] font-mono-data mt-0.5 truncate" style={{ color: "#3A4A66" }}>
                        {truncateWallet(c.solana_wallet)}
                      </p>
                    </div>

                    {/* Total paid + arrow */}
                    <div className="flex-shrink-0 flex items-center gap-2">
                      <div className="text-right">
                        <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Total paid</p>
                        <p
                          className="font-mono-data text-sm font-semibold"
                          style={{ color: totalPaid > 0 ? "var(--green)" : "var(--text-muted)" }}
                        >
                          ${totalPaid.toFixed(2)}
                        </p>
                      </div>
                      <svg
                        width="16" height="16" viewBox="0 0 24 24" fill="none"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className="flex-shrink-0 transition-all duration-150"
                        style={{
                          stroke: accentColor,
                          opacity: isFocused ? 1 : 0,
                          transform: isFocused ? "translateX(0)" : "translateX(-6px)",
                        }}
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </div>
                  </button>
                );
              })}

              <p className="text-[12px] text-center pt-4" style={{ color: "var(--text-muted)" }}>
                💡 Select a contractor to set the payout amount. USDC settles on Solana in &lt;2s.
              </p>
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN (40%) ── */}
        <div
          className="flex-[2] min-w-[260px] self-start sticky top-6 space-y-4"
          style={{ background: "radial-gradient(ellipse at top right, rgba(0,230,160,0.04) 0%, transparent 60%)" }}
        >
          {/* Quick Stats */}
          <div className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: "var(--text-muted)" }}>
              Your Payout Activity
            </p>
            <div className="space-y-3">
              {[
                { label: "This month", value: `$${totalThisMonth.toFixed(2)}`, green: true },
                { label: "Average payout", value: `$${avgPayout.toFixed(2)}`, green: false },
                { label: "Last payout", value: lastPayoutItem ? daysAgo(lastPayoutItem.created_at) : "—", green: false },
                { label: "Top contractor", value: mostPaidContractor?.name ?? "—", green: false, truncate: true },
              ].map(({ label, value, green, truncate }) => (
                <div key={label} className="flex justify-between items-baseline gap-2">
                  <span className="text-xs flex-shrink-0" style={{ color: "var(--text-muted)" }}>{label}</span>
                  <span
                    className={`font-mono-data text-xs font-semibold ${green ? "glow-green" : ""} ${truncate ? "truncate text-right" : ""}`}
                    style={{ color: green ? "var(--green)" : "var(--text-secondary)", maxWidth: truncate ? "120px" : undefined }}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Payouts */}
          {recentPayouts.length > 0 && (
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                  Recent Payouts
                </p>
                <button
                  onClick={() => router.push("/payouts")}
                  className="text-[11px] transition-colors hover:underline"
                  style={{ color: "var(--green)" }}
                >
                  View all →
                </button>
              </div>
              <div className="space-y-3">
                {recentPayouts.map((p) => {
                  const name = p.contractors?.name ?? "Unknown";
                  const initials = getInitials(name);
                  return (
                    <div key={p.id} className="flex items-center gap-2.5">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
                      >
                        <span className="text-[9px] font-bold" style={{ color: "#080C14" }}>{initials}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate" style={{ color: "var(--text-primary)" }}>{name}</p>
                        <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{daysAgo(p.created_at)}</p>
                      </div>
                      <span className="font-mono-data text-xs font-semibold flex-shrink-0" style={{ color: "var(--green)" }}>
                        ${Number(p.amount_usd).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Why Remlo */}
          <div className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: "var(--text-muted)" }}>
              Why Remlo?
            </p>
            <div className="space-y-3">
              {[
                { icon: "⚡", label: "<2 second settlement" },
                { icon: "💰", label: "~$0.001 network fee" },
                { icon: "🌍", label: "220+ countries supported" },
              ].map(({ icon, label }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-base leading-none">{icon}</span>
                  <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
