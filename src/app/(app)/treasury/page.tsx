"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/utils";
import { useToast } from "@/components/toast";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface RecentPayout {
  amount_usd: number;
  created_at: string;
  contractors: { name: string } | null;
}

interface OutflowPoint {
  date: string;
  amount: number;
}

interface Policy {
  spendCapDaily: number;
  txLimit: number;
  autoRefill: boolean;
  notifyOnPayout: boolean;
  notifyOnLow: boolean;
}

interface TreasuryInfo {
  balance: number;
  available: number;
  pendingSum: number;
  pendingCount: number;
  avgPayout: number;
  runwayCount: number | null;
  walletAddress: string;
  fullAddress: string;
  cluster: string;
  rpcError: boolean;
  tier: "healthy" | "low" | "critical" | "insufficient";
  thresholds: { low: number; critical: number };
  isOwner: boolean;
  ownerEmail: string | null;
  recentPayouts: RecentPayout[];
  outflowChart: OutflowPoint[];
  policy: Policy;
  syncedAt: string;
}

const tierConfig = {
  healthy: {
    label: "Healthy",
    color: "var(--green)",
    bg: "var(--green-dim)",
    border: "var(--green-border)",
    icon: "✓",
    message: "Treasury has sufficient runway.",
  },
  low: {
    label: "Low balance",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.3)",
    icon: "⚠",
    message: "Balance is below the recommended threshold. Consider topping up.",
  },
  critical: {
    label: "Critical",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.3)",
    icon: "🚨",
    message: "Balance is critically low. Top up immediately to avoid failed payouts.",
  },
  insufficient: {
    label: "Insufficient",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.15)",
    border: "rgba(239,68,68,0.4)",
    icon: "🚨",
    message: "Balance cannot cover pending payouts. Top up immediately.",
  },
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

export default function TreasuryPage() {
  const [info, setInfo] = useState<TreasuryInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  async function load() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/treasury/info");
      if (res.status === 401) {
        const next = encodeURIComponent("/treasury");
        router.replace(`/login?next=${next}`);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setInfo(data);
      } else {
        setError(`Server returned ${res.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="py-20 text-center text-[var(--text-muted)]">Loading treasury...</div>;
  }
  if (error || !info) {
    return (
      <div className="max-w-md mx-auto mt-20 card p-6 text-center">
        <p className="text-sm text-[var(--text-primary)] font-medium mb-1">Couldn&apos;t load treasury</p>
        <p className="text-xs text-[var(--text-muted)] mb-4">{error || "Try refreshing or sign in again."}</p>
        <button onClick={load} className="px-4 py-2 text-xs rounded-lg font-semibold btn-primary">
          Retry
        </button>
      </div>
    );
  }

  const tier = tierConfig[info.tier];

  return (
    <div className="animate-fade-in relative z-[1] max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold text-[var(--text-primary)]">Treasury</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Solana hot wallet · {info.cluster}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg font-medium transition-colors btn-export"
          >
            <svg
              width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
              className={refreshing ? "animate-spin" : ""}
            >
              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-3" />
            </svg>
            Refresh
          </button>
          {info.isOwner ? (
            <a
              href={`https://faucet.solana.com/?cluster=${info.cluster}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 text-xs rounded-lg font-semibold btn-primary"
            >
              + Refill Treasury
            </a>
          ) : (
            <button
              onClick={() => setShowRequestModal(true)}
              className="px-4 py-2 text-xs rounded-lg font-semibold btn-primary"
            >
              Request Refill
            </button>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div
        className="card p-4 mb-5 flex items-start gap-3"
        style={{
          borderLeft: `3px solid ${tier.color}`,
          background: tier.bg,
        }}
      >
        <span className="text-xl flex-shrink-0">{tier.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold" style={{ color: tier.color }}>
            {tier.label}{" "}
            <span className="text-[var(--text-muted)] font-normal text-xs ml-1">
              · ALL SYSTEMS
            </span>
          </p>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">{tier.message}</p>
        </div>
        <div className="text-right flex-shrink-0 hidden md:block">
          <p className="text-[10px] text-[var(--text-muted)]">
            ${info.thresholds.low} low · ${info.thresholds.critical} critical
          </p>
          <p className="text-[10px] text-[var(--text-muted)] opacity-70 mt-0.5">
            Last sync: {timeAgo(info.syncedAt)}
          </p>
        </div>
        {!info.isOwner && info.tier !== "healthy" && (
          <button
            onClick={() => setShowRequestModal(true)}
            className="text-xs font-semibold whitespace-nowrap px-3 py-1.5 rounded-md flex-shrink-0"
            style={{ background: tier.color, color: "var(--on-green)" }}
          >
            Request refill →
          </button>
        )}
      </div>

      {/* Top metrics grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-5">
        <MetricCard
          label="Total balance"
          value={`$${info.balance.toFixed(2)}`}
          unit="USDC"
          accent={tier.color}
          highlight
          sub={info.balance > 0 ? `${(info.balance / info.balance).toFixed(1)}× ${info.thresholds.low > 0 ? "the low threshold" : ""}` : undefined}
        />
        <MetricCard
          label="Available"
          value={`$${info.available.toFixed(2)}`}
          sub={`$${info.pendingSum.toFixed(2)} reserved`}
        />
        <MetricCard
          label="Pending payouts"
          value={String(info.pendingCount)}
          sub={info.pendingCount > 0 ? `$${info.pendingSum.toFixed(2)} locked` : "None in flight"}
        />
        <MetricCard
          label="Runway"
          value={info.runwayCount !== null ? `~${info.runwayCount}` : "—"}
          sub={info.avgPayout > 0 ? `payouts at avg $${info.avgPayout.toFixed(2)}` : "no history yet"}
        />
      </div>

      {/* Two-column layout: wallet details + recent outflows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        {/* Wallet details */}
        <div className="card p-6">
          <h2 className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium mb-4">
            Wallet details
          </h2>
          <div className="space-y-3">
            <Row label="Address" value={info.walletAddress} mono />
            <Row label="Network" value={`Solana ${info.cluster}`} />
            <Row label="Token" value="USDC (SPL)" />
            <Row
              label="Owner"
              value={info.isOwner ? "You" : info.ownerEmail || "—"}
              accent={info.isOwner ? "var(--green)" : undefined}
            />
            <Row
              label="Low threshold"
              value={`$${info.thresholds.low.toFixed(0)}`}
              sub="amber alert"
            />
            <Row
              label="Critical threshold"
              value={`$${info.thresholds.critical.toFixed(0)}`}
              sub="red alert"
            />
            <Row
              label="Auto-refill"
              value={info.policy.autoRefill ? "ON" : "OFF"}
              accent={info.policy.autoRefill ? "var(--green)" : "var(--text-muted)"}
            />
          </div>
          <div className="pt-4 mt-4 border-t border-[var(--border)]">
            <a
              href={`https://solscan.io/address/${info.fullAddress}?cluster=${info.cluster}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-medium flex items-center gap-1.5"
              style={{ color: "var(--green)" }}
            >
              View on Solscan
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            </a>
          </div>
        </div>

        {/* Recent outflows */}
        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium">
              Recent outflows
            </h2>
            <Link
              href="/payouts"
              className="text-[11px] font-medium flex items-center gap-1"
              style={{ color: "var(--green)" }}
            >
              View all
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
              </svg>
            </Link>
          </div>
          {info.recentPayouts.length === 0 ? (
            <p className="text-sm text-[var(--text-muted)]">No payouts yet.</p>
          ) : (
            <div className="space-y-3">
              {info.recentPayouts.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
                    >
                      <span className="text-[10px] font-bold" style={{ color: "var(--on-green)" }}>
                        {(p.contractors?.name || "?").split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase()}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-[var(--text-primary)] truncate">
                        {p.contractors?.name || "Unknown"}
                      </p>
                      <p className="text-[10px] text-[var(--text-muted)]">{formatDate(p.created_at)}</p>
                    </div>
                  </div>
                  <span className="font-mono-data text-sm font-medium" style={{ color: "#EF4444" }}>
                    −${Number(p.amount_usd).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom row: Outflow chart + Alerts & policy */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Outflow chart - 2 cols */}
        <div className="card p-6 lg:col-span-2">
          <h2 className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium mb-4">
            Outflow · Last 30 days
          </h2>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={info.outflowChart} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="outflowGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00E6A0" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#00E6A0" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  axisLine={false}
                  tickLine={false}
                  interval={Math.floor(info.outflowChart.length / 6)}
                />
                <YAxis
                  tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                  tickFormatter={(v) => `$${v}`}
                  axisLine={false}
                  tickLine={false}
                  width={45}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg-surface)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--text-muted)" }}
                  formatter={(v) => [`$${Number(v).toFixed(2)}`, "Outflow"]}
                  cursor={{ stroke: "var(--green)", strokeOpacity: 0.3 }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#00E6A0"
                  strokeWidth={2}
                  fill="url(#outflowGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts & Policy */}
        <div className="card p-6">
          <h2 className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium mb-4">
            Alerts &amp; policy
          </h2>
          <div className="space-y-4">
            <PolicyRow
              icon={<DollarSign />}
              label="Spend cap"
              value={`$${info.policy.spendCapDaily.toLocaleString()} / day`}
            />
            <PolicyRow
              icon={<ArrowsCircle />}
              label="Single tx limit"
              value={`$${info.policy.txLimit.toLocaleString()}`}
            />
            <div>
              <p className="text-[11px] text-[var(--text-muted)] mb-2">Notify on:</p>
              <div className="space-y-1.5">
                <NotifyItem enabled={info.policy.notifyOnPayout} label="Each successful payout" />
                <NotifyItem enabled={info.policy.notifyOnLow} label="Low balance" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRequestModal && (
        <RequestRefillModal
          balance={info.balance}
          tier={info.tier}
          ownerEmail={info.ownerEmail}
          onClose={() => setShowRequestModal(false)}
          onSent={() => {
            setShowRequestModal(false);
            toast("Refill request sent to treasury owner", "success");
          }}
        />
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  unit,
  sub,
  accent,
  highlight,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  accent?: string;
  highlight?: boolean;
}) {
  return (
    <div className="card p-5">
      <p className="text-[10px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium mb-2">
        {label}
      </p>
      <p
        className="font-mono-data leading-none"
        style={{
          color: accent || "var(--text-primary)",
          fontSize: highlight ? "26px" : "20px",
          fontWeight: 600,
        }}
      >
        {value}
        {unit && (
          <span className="text-[12px] font-medium ml-1.5" style={{ color: "var(--text-muted)" }}>
            {unit}
          </span>
        )}
      </p>
      {sub && <p className="text-[11px] text-[var(--text-muted)] mt-2">{sub}</p>}
    </div>
  );
}

function Row({
  label,
  value,
  sub,
  mono,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  mono?: boolean;
  accent?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs text-[var(--text-muted)]">{label}</div>
      <div className="text-right">
        <p
          className={`text-sm ${mono ? "font-mono-data" : ""}`}
          style={{ color: accent || "var(--text-primary)" }}
        >
          {value}
        </p>
        {sub && <p className="text-[10px] text-[var(--text-muted)]">{sub}</p>}
      </div>
    </div>
  );
}

function PolicyRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-[var(--green-dim)] flex items-center justify-center flex-shrink-0" style={{ color: "var(--green)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] text-[var(--text-muted)]">{label}</p>
        <p className="text-sm font-medium text-[var(--text-primary)] font-mono-data">{value}</p>
      </div>
    </div>
  );
}

function NotifyItem({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center flex-shrink-0"
        style={{
          background: enabled ? "var(--green)" : "transparent",
          border: enabled ? "none" : "1px solid var(--border)",
        }}
      >
        {enabled && (
          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="var(--on-green)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 12 10 16 18 8" />
          </svg>
        )}
      </span>
      <span className={enabled ? "text-[var(--text-primary)]" : "text-[var(--text-muted)] line-through"}>
        {label}
      </span>
    </div>
  );
}

function DollarSign() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </svg>
  );
}

function ArrowsCircle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" />
      <polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  );
}

function RequestRefillModal({
  balance,
  tier,
  ownerEmail,
  onClose,
  onSent,
}: {
  balance: number;
  tier: "healthy" | "low" | "critical" | "insufficient";
  ownerEmail: string | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const suggested = Math.max(500, Math.ceil((1000 - balance) / 100) * 100);
  const [amount, setAmount] = useState(suggested);
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const { toast } = useToast();

  const urgency =
    tier === "critical" || tier === "insufficient"
      ? "critical"
      : tier === "low"
      ? "urgent"
      : "normal";

  async function send() {
    if (!amount || amount <= 0) {
      toast("Enter a valid amount", "error");
      return;
    }
    setSending(true);
    const res = await fetch("/api/treasury/request-refill", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount, balance, note, urgency }),
    });
    if (res.ok) {
      onSent();
    } else {
      const data = await res.json().catch(() => ({}));
      toast(data.error || "Failed to send request", "error");
    }
    setSending(false);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.6)" }}
      onClick={onClose}
    >
      <div
        className="card p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-heading font-bold text-[var(--text-primary)]">Request Treasury Refill</h2>
        <p className="text-xs text-[var(--text-muted)] mt-1">
          An email will be sent to {ownerEmail || "the treasury owner"}.
        </p>

        <div className="mt-5 space-y-4">
          <div>
            <label className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium block mb-1.5">
              Current balance
            </label>
            <p className="font-mono-data text-[var(--text-primary)]">${balance.toFixed(2)} USDC</p>
          </div>

          <div>
            <label className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium block mb-1.5">
              Requested amount (USDC)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              min={1}
              max={1000000}
              className="w-full px-3 py-2 text-sm input-base font-mono-data"
            />
          </div>

          <div>
            <label className="text-[11px] tracking-[0.08em] uppercase text-[var(--text-muted)] font-medium block mb-1.5">
              Note (optional)
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder="e.g. We have 12 pending payouts this week"
              rows={3}
              className="w-full px-3 py-2 text-sm input-base resize-none"
            />
            <p className="text-[10px] text-[var(--text-muted)] mt-1">{note.length}/500</p>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-6">
          <button
            onClick={onClose}
            disabled={sending}
            className="px-4 py-2 text-xs rounded-lg font-medium"
            style={{ color: "var(--text-muted)" }}
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={sending}
            className="px-4 py-2 text-xs rounded-lg font-semibold btn-primary disabled:opacity-50"
          >
            {sending ? "Sending..." : "Send request"}
          </button>
        </div>
      </div>
    </div>
  );
}
