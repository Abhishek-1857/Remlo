"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { TxHash } from "@/components/tx-hash";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/toast";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface Payout {
  id: string;
  amount_usd: number;
  status: string;
  solana_tx_sig: string | null;
  dodo_payment_id: string | null;
  bulk_payout_id: string | null;
  settlement_ms: number | null;
  created_at: string;
  contractor_id: string;
  contractors: {
    name: string;
    solana_wallet: string;
    owner_id: string;
  };
}

interface WalletBalance {
  balance: number | null;
  walletAddress?: string;
  fullAddress?: string;
  cluster?: string;
  error?: string;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[var(--text-muted)]">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [contractors, setContractors] = useState<{ id: string; name: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const payout = searchParams.get("payout");
    if (payout === "success") {
      toast("Payment initiated! Waiting for confirmation...", "success");
    } else if (payout === "bulk") {
      toast("Bulk payout initiated! Sending USDC to all contractors...", "success");
    }
  }, [searchParams, toast]);

  useEffect(() => {
    fetchPayouts();
    fetchContractors();
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchWalletBalance();
    const interval = setInterval(fetchWalletBalance, 30_000);
    return () => clearInterval(interval);
  }, []);

  async function fetchPayouts() {
    const res = await fetch("/api/payouts");
    if (res.ok) setPayouts(await res.json());
    setLoading(false);
  }

  async function fetchContractors() {
    const res = await fetch("/api/contractors");
    if (res.ok) setContractors(await res.json());
  }

  async function fetchWalletBalance() {
    setWalletLoading(true);
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) setWalletBalance(await res.json());
      else setWalletBalance({ balance: null, error: "RPC unavailable" });
    } catch {
      setWalletBalance({ balance: null, error: "RPC unavailable" });
    } finally {
      setWalletLoading(false);
    }
  }

  async function handleExportCSV() {
    setExporting(true);
    const res = await fetch("/api/payouts/export");
    if (res.status === 404) {
      toast("No payouts to export yet", "error");
      setExporting(false);
      return;
    }
    if (!res.ok) {
      toast("Export failed", "error");
      setExporting(false);
      return;
    }
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payzap-payouts-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    setExporting(false);
  }

  async function handleRetry(payoutId: string) {
    setRetrying(payoutId);
    const res = await fetch(`/api/payout/${payoutId}/retry`, { method: "POST" });
    if (res.ok) {
      toast("Payout retried successfully!", "success");
    } else {
      const data = await res.json();
      toast(data.error || "Retry failed", "error");
    }
    setRetrying(null);
    fetchPayouts();
  }

  async function handleCancel(payoutId: string) {
    setCancelling(payoutId);
    const res = await fetch(`/api/payout/${payoutId}/cancel`, { method: "POST" });
    if (res.ok) {
      toast("Payout cancelled", "success");
    } else {
      const data = await res.json();
      toast(data.error || "Cancel failed", "error");
    }
    setCancelling(null);
    fetchPayouts();
  }

  const now = new Date();

  const totalPaid = payouts
    .filter((p) => p.status === "done")
    .reduce((sum, p) => sum + Number(p.amount_usd), 0);

  // This month vs last month for paid amount
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const thisMonthPaid = payouts
    .filter((p) => p.status === "done" && new Date(p.created_at) >= thisMonthStart)
    .reduce((s, p) => s + Number(p.amount_usd), 0);
  const lastMonthPaid = payouts
    .filter((p) => p.status === "done" && new Date(p.created_at) >= lastMonthStart && new Date(p.created_at) < thisMonthStart)
    .reduce((s, p) => s + Number(p.amount_usd), 0);
  const paidTrendPct = lastMonthPaid > 0 ? Math.round(((thisMonthPaid - lastMonthPaid) / lastMonthPaid) * 100) : null;

  const contractorCount = contractors.length;
  const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const newContractorsThisWeek = contractors.filter((c) => new Date(c.created_at) > oneWeekAgo).length;

  const thisMonth = payouts.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const lastMonthCount = payouts.filter((p) => {
    const d = new Date(p.created_at);
    return d.getMonth() === lastMonthStart.getMonth() && d.getFullYear() === lastMonthStart.getFullYear();
  }).length;
  const monthDiff = thisMonth - lastMonthCount;
  const prevMonthName = lastMonthStart.toLocaleString("default", { month: "long" });

  const WIRE_FEE = 28;
  const SOLANA_FEE = 0.001;
  const donePayouts = payouts.filter((p) => p.status === "done");
  const donePayoutsCount = donePayouts.length;
  const feesSaved = donePayoutsCount * (WIRE_FEE - SOLANA_FEE);

  const settledPayouts = donePayouts.filter((p) => p.settlement_ms && p.settlement_ms > 0);
  const totalSettlementMs = settledPayouts.reduce((s, p) => s + (p.settlement_ms || 0), 0);
  const avgSettlementMs = settledPayouts.length > 0 ? totalSettlementMs / settledPayouts.length : null;
  const totalSettlementSec = totalSettlementMs / 1000;

  // Last 30 days area chart data
  const dailyData = (() => {
    const days: { date: string; amount: number }[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const total = payouts
        .filter((p) => {
          const pd = new Date(p.created_at);
          return pd.getDate() === d.getDate() && pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear() && p.status === "done";
        })
        .reduce((s, p) => s + Number(p.amount_usd), 0);
      days.push({ date: key, amount: total });
    }
    return days;
  })();

  // Status donut data
  const statusCounts = payouts.reduce<Record<string, number>>((acc, p) => {
    acc[p.status] = (acc[p.status] || 0) + 1;
    return acc;
  }, {});
  const donutData = Object.entries(statusCounts).map(([name, value]) => ({ name, value }));
  const donutColors: Record<string, string> = { done: "#00E6A0", pending: "#F59E0B", failed: "#EF4444", processing: "#6366F1" };
  const doneCount = statusCounts["done"] || 0;
  const totalPayouts = payouts.length;
  const donePct = totalPayouts > 0 ? Math.round((doneCount / totalPayouts) * 100) : 0;

  return (
    <div className="animate-fade-in relative z-[1]">
      {/* Stat Cards — Two-row grid */}
      <div className="dash-stats-grid mb-5 stagger-children">
        {/* ── TOP ROW: 3 cards ── */}

        {/* Total Paid Out */}
        <div className="card p-6 min-h-[130px] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium">Total Paid Out</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--green-dim)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
              </svg>
            </div>
          </div>
          <p className="text-[28px] font-mono-data font-semibold text-[var(--green)] leading-none glow-green">
            ${totalPaid.toFixed(2)}
          </p>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-[var(--text-muted)]">all time</p>
            {paidTrendPct !== null && (
              <span className="trend-pill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
                {paidTrendPct > 0 ? "+" : ""}{paidTrendPct}%
              </span>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(90deg, #00E6A0, transparent)' }} />
        </div>

        {/* Active Contractors */}
        <div className="card p-6 min-h-[130px] flex flex-col justify-between">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium">Active Contractors</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--green-dim)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
          </div>
          <p className="text-[28px] font-mono-data font-semibold text-[var(--text-primary)] leading-none">{contractorCount}</p>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-[var(--text-muted)]">registered wallets</p>
            {newContractorsThisWeek > 0 && (
              <span className="trend-pill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
                </svg>
                +{newContractorsThisWeek} this week
              </span>
            )}
          </div>
        </div>

        {/* This Month */}
        <div className="card p-6 min-h-[130px] flex flex-col justify-between">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium">This Month</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--green-dim)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
          </div>
          <p className="text-[28px] font-mono-data font-semibold text-[var(--text-primary)] leading-none">{thisMonth}</p>
          <div className="flex items-center justify-between mt-3">
            <p className="text-[11px] text-[var(--text-muted)]">payouts</p>
            <span className={`trend-pill ${monthDiff < 0 ? "trend-pill-red" : ""}`}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                {monthDiff >= 0
                  ? <><line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" /></>
                  : <><line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" /></>
                }
              </svg>
              {monthDiff >= 0 ? "+" : ""}{monthDiff} vs {prevMonthName}
            </span>
          </div>
        </div>

        {/* ── BOTTOM ROW ── */}

        {/* Hot Wallet — spans 2 columns */}
        {(() => {
          const balanceValue = walletBalance?.balance ?? null;
          const hasError = !!walletBalance?.error;
          const isLow = balanceValue !== null && balanceValue < 10;
          const balanceColor = hasError || balanceValue === null
            ? "var(--text-muted)"
            : isLow ? "#F59E0B" : "var(--green)";
          return (
            <div className="dash-hot-wallet card p-6 min-h-[130px] relative overflow-hidden">
              <div className="flex gap-6 h-full">
                {/* Left section (60%) */}
                <div className="flex-[3] flex flex-col justify-between min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-[var(--green-dim)] flex items-center justify-center flex-shrink-0">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                        <path d="M16 3H8a2 2 0 0 0-2 2v2" />
                        <circle cx="18" cy="14" r="1.5" fill="var(--green)" />
                      </svg>
                    </div>
                    <span className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium">Hot Wallet</span>
                  </div>

                  <p
                    className={`text-[28px] font-mono-data font-semibold leading-none ${walletLoading ? "animate-pulse" : ""} ${!hasError && balanceValue !== null && !isLow ? "glow-green" : ""}`}
                    style={{ color: balanceColor }}
                  >
                    {hasError ? "—" : balanceValue === null ? "—" : `$${balanceValue.toFixed(2)}`}
                    <span className="text-[14px] font-medium ml-1.5" style={{ color: "var(--text-muted)" }}>USDC</span>
                  </p>

                  <div className="flex items-center gap-3 mt-3">
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {hasError ? <span style={{ color: "#EF4444" }}>RPC error</span> : "treasury balance"}
                    </p>
                    {!hasError && isLow && (
                      <span className="text-[10px] flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ color: "#F59E0B", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)" }}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                        </svg>
                        Low balance
                      </span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-px self-stretch" style={{ background: "var(--border)" }} />

                {/* Right section (40%) */}
                <div className="flex-[2] flex flex-col justify-between min-w-0">
                  {/* Refresh button top-right */}
                  <div className="flex justify-end">
                    <button
                      onClick={fetchWalletBalance}
                      disabled={walletLoading}
                      className="flex items-center justify-center w-7 h-7 rounded-md transition-colors disabled:opacity-40"
                      style={{ color: "var(--text-muted)", background: "var(--bg-elevated)" }}
                      title="Refresh balance"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--green)"; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; }}
                    >
                      <svg
                        width="13" height="13" viewBox="0 0 24 24" fill="none"
                        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                        className={walletLoading ? "animate-spin" : ""}
                      >
                        <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3" />
                      </svg>
                    </button>
                  </div>

                  {/* Wallet address */}
                  {walletBalance?.fullAddress ? (
                    <div className="space-y-2">
                      <p className="font-mono-data text-[11px] text-[var(--text-muted)] truncate">
                        {walletBalance.walletAddress}
                      </p>
                      <a
                        href={`https://solscan.io/address/${walletBalance.fullAddress}?cluster=${walletBalance.cluster}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[11px] font-medium transition-colors w-fit"
                        style={{ color: "var(--green)" }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                        </svg>
                        View on Solscan
                      </a>
                    </div>
                  ) : (
                    <p className="font-mono-data text-[11px] text-[var(--text-muted)]">—</p>
                  )}
                </div>
              </div>

              <div
                className="absolute bottom-0 left-0 right-0 h-[2px]"
                style={{
                  background: !hasError && isLow
                    ? "linear-gradient(90deg, #F59E0B, transparent)"
                    : "linear-gradient(90deg, rgba(0,230,160,0.3), transparent)",
                }}
              />
            </div>
          );
        })()}

        {/* Fees Saved — spans 1 column */}
        <div className="dash-fees-saved card p-6 min-h-[130px] flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-start justify-between mb-3">
            <span className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium">Fees Saved</span>
            <div className="w-8 h-8 rounded-lg bg-[var(--green-dim)] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8" />
                <line x1="12" y1="6" x2="12" y2="8" /><line x1="12" y1="16" x2="12" y2="18" />
              </svg>
            </div>
          </div>
          <p
            className={`text-[28px] font-mono-data font-semibold leading-none ${feesSaved > 0 ? "glow-green" : ""}`}
            style={{ color: feesSaved > 0 ? "var(--green)" : "var(--text-muted)" }}
          >
            ${feesSaved.toFixed(0)}
          </p>
          <div className="mt-3 space-y-1">
            <p className="text-[11px] text-[var(--text-muted)]">
              {donePayoutsCount > 0
                ? <>{donePayoutsCount} payouts × ${WIRE_FEE} wire fee = <span style={{ color: "var(--green)" }}>${feesSaved.toFixed(0)} saved</span></>
                : "vs wire transfers"
              }
            </p>
            {donePayoutsCount > 0 && (
              <p className="text-[11px] text-[var(--text-muted)]">
                vs ${(donePayoutsCount * SOLANA_FEE).toFixed(3)} Solana fees paid
              </p>
            )}
            {settledPayouts.length > 0 && (
              <div className="mt-2 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
                <p className="text-[11px] text-[var(--text-muted)]">
                  <span style={{ color: "var(--green)" }}>⚡ {settledPayouts.length} payouts in {totalSettlementSec.toFixed(1)}s</span>
                </p>
                <p className="text-[11px] text-[var(--text-muted)]">
                  Avg: <span className="font-mono-data" style={{ color: "var(--green)" }}>{(avgSettlementMs! / 1000).toFixed(1)}s</span> per payout
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-0.5" style={{ opacity: 0.6 }}>
                  vs wire transfers: 3–5 days
                </p>
              </div>
            )}
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: "linear-gradient(90deg, #00E6A0, transparent)" }} />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        {/* Area chart — spans 2 cols */}
        <div className="card p-5 lg:col-span-2">
          <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium mb-4">
            Payout Volume · Last 30 Days
          </p>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={dailyData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="greenGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#00E6A0" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#00E6A0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#0E1420" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: "#3A4A66", fontFamily: "JetBrains Mono, monospace" }}
                tickLine={false}
                axisLine={false}
                interval={6}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#3A4A66", fontFamily: "JetBrains Mono, monospace" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => `$${v}`}
              />
              <Tooltip
                contentStyle={{ background: "var(--bg-elevated)", border: "1px solid rgba(0,230,160,0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}
                cursor={{ stroke: "#00E6A0", strokeWidth: 1, strokeDasharray: "4 2" }}
                formatter={(v) => [`$${Number(v).toFixed(2)}`, "Paid out"]}
                labelStyle={{ color: "#4A5A74", marginBottom: 4 }}
              />
              <Area type="monotone" dataKey="amount" stroke="#00E6A0" strokeWidth={2} fill="url(#greenGrad)" dot={false} activeDot={{ r: 4, fill: "#00E6A0", strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Donut chart */}
        <div className="card p-5 flex flex-col">
          <p className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium mb-4">
            Status Breakdown
          </p>
          {donutData.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-xs text-[var(--text-muted)]">No data yet</div>
          ) : (
            <div className="relative">
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={donutData} cx="50%" cy="45%" innerRadius={44} outerRadius={70} paddingAngle={3} dataKey="value" strokeWidth={0}>
                    {donutData.map((entry) => (
                      <Cell key={entry.name} fill={donutColors[entry.name] || "#6366F1"} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "var(--bg-elevated)", border: "1px solid rgba(0,230,160,0.2)", borderRadius: "8px", fontSize: "12px", color: "var(--text-primary)" }}
                    formatter={(v, name) => [v, String(name).charAt(0).toUpperCase() + String(name).slice(1)]}
                  />
                  <Legend iconType="circle" iconSize={8} formatter={(v) => <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{v.charAt(0).toUpperCase() + v.slice(1)}</span>} />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute pointer-events-none" style={{ top: 0, left: 0, right: 0, height: 162, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="text-center">
                  <div className="font-mono-data font-bold text-[18px] glow-green" style={{ color: '#00E6A0', lineHeight: 1 }}>{donePct}%</div>
                  <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Done</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Recent Payouts */}
      <div className="card overflow-hidden flex flex-col" style={{ minHeight: "calc(100vh - 340px)" }}>
          <div className="px-5 py-4 border-b border-[var(--border)] flex items-start justify-between">
            <div>
              <h2 className="font-heading font-semibold text-sm text-[var(--text-primary)]">
                Recent Payouts
              </h2>
              <p className="text-[11px] text-[var(--text-muted)] mt-0.5">Latest transactions on Solana</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md font-medium transition-colors disabled:opacity-50"
                style={{ border: "1px solid var(--border-bright)", color: "var(--text-muted)", background: "transparent" }}
                onMouseEnter={(e) => { if (!exporting) { (e.currentTarget as HTMLElement).style.color = "var(--green)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--green)"; } }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-bright)"; }}
              >
                {exporting ? (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                  </svg>
                ) : (
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                  </svg>
                )}
                {exporting ? "Exporting..." : "Export CSV"}
              </button>
              <Link href="/payouts" className="text-xs text-[var(--green)] hover:underline flex items-center gap-1">
                View all
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </Link>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center text-[var(--text-muted)] text-sm flex-1 flex items-center justify-center">
              Loading...
            </div>
          ) : payouts.length === 0 ? (
            <div className="p-12 text-center flex-1 flex flex-col items-center justify-center">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 opacity-60">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-sm text-[var(--text-muted)] mb-2">No payouts yet.</p>
              <Link href="/contractors" className="text-sm text-[var(--green)] hover:underline">
                Send your first payment →
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header border-b border-[var(--border)]">
                    <th className="px-5 py-3 text-left font-medium">Contractor</th>
                    <th className="px-5 py-3 text-left font-medium">Amount</th>
                    <th className="px-5 py-3 text-left font-medium w-[120px]">Status</th>
                    <th className="px-5 py-3 text-left font-medium">Tx Hash</th>
                    <th className="px-5 py-3 text-left font-medium">Time</th>
                    <th className="px-5 py-3 text-left font-medium"></th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => {
                    const name = p.contractors?.name || "";
                    const initials = name ? getInitials(name) : "?";
                    return (
                      <tr key={p.id} className="table-row">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
                            >
                              <span className="text-[10px] font-bold" style={{ color: "var(--bg-base)" }}>{initials}</span>
                            </div>
                            <span className="font-medium text-[var(--text-primary)]">{name || "—"}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="font-mono-data text-[var(--green)]">
                            ${Number(p.amount_usd).toFixed(2)}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-0.5">
                            <StatusBadge status={p.status} />
                            {p.status === "done" && p.settlement_ms && (
                              <span className="text-[10px] font-mono-data" style={{ color: "var(--green)" }}>
                                ⚡ {(p.settlement_ms / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          {p.solana_tx_sig ? (
                            <a
                              href={`https://solscan.io/tx/${p.solana_tx_sig}?cluster=devnet`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group/tx flex items-center gap-1"
                              style={{ color: '#3A4A66' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#00E6A0')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#3A4A66')}
                            >
                              <TxHash hash={p.solana_tx_sig} />
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-0 group-hover/tx:opacity-100 transition-opacity flex-shrink-0">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          ) : (
                            <span className="text-[var(--text-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs">
                          {formatDate(p.created_at)}
                        </td>
                        <td className="px-5 py-3.5">
                          {p.status === "failed" && (
                            <button
                              onClick={() => handleRetry(p.id)}
                              disabled={retrying === p.id}
                              className="text-xs text-[var(--amber)] hover:text-[var(--green)] font-medium disabled:opacity-50 transition-colors"
                            >
                              {retrying === p.id ? "Retrying..." : "Retry"}
                            </button>
                          )}
                          {(p.status === "pending" || p.status === "processing") && (
                            <button
                              onClick={() => handleCancel(p.id)}
                              disabled={cancelling === p.id}
                              className="text-xs font-medium disabled:opacity-50 transition-colors"
                              style={{ color: "#EF4444" }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = "#FF7070")}
                              onMouseLeave={(e) => (e.currentTarget.style.color = "#EF4444")}
                            >
                              {cancelling === p.id ? "Cancelling..." : "Cancel"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
      </div>
    </div>
  );
}
