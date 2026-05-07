"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

interface Contractor {
  id: string;
  name: string;
  email: string | null;
  solana_wallet: string;
}

interface PayoutRecord {
  id: string;
  bulk_payout_id: string | null;
  amount_usd: number;
  status: string;
  created_at: string;
}

interface BulkGroup {
  id: string;
  created_at: string;
  count: number;
  total: number;
  status: string;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function truncateWallet(wallet: string) {
  return `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function BulkPayoutPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Map<string, string>>(new Map());
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState("");
  const [recentBulk, setRecentBulk] = useState<BulkGroup[]>([]);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      fetch("/api/contractors").then((r) => r.json()),
      fetch("/api/payouts").then((r) => r.json()),
    ]).then(([cs, ps]) => {
      setContractors(cs);

      // Reconstruct bulk history from payout records
      const bulkMap: Record<string, { created_at: string; count: number; total: number; statuses: string[] }> = {};
      for (const p of ps as PayoutRecord[]) {
        if (!p.bulk_payout_id) continue;
        if (!bulkMap[p.bulk_payout_id]) {
          bulkMap[p.bulk_payout_id] = { created_at: p.created_at, count: 0, total: 0, statuses: [] };
        }
        const entry = bulkMap[p.bulk_payout_id];
        entry.count++;
        entry.total += Number(p.amount_usd);
        entry.statuses.push(p.status);
        if (new Date(p.created_at) < new Date(entry.created_at)) entry.created_at = p.created_at;
      }

      const groups = Object.entries(bulkMap)
        .map(([id, data]) => {
          const statuses = new Set(data.statuses);
          const status = statuses.has("done") && statuses.size === 1 ? "done"
            : statuses.has("failed") ? "partial"
            : "processing";
          return { id, created_at: data.created_at, count: data.count, total: data.total, status };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 2);

      setRecentBulk(groups);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = contractors.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const allSelected = filtered.length > 0 && filtered.every((c) => selected.has(c.id));

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Map(prev);
        filtered.forEach((c) => next.delete(c.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Map(prev);
        filtered.forEach((c) => { if (!next.has(c.id)) next.set(c.id, ""); });
        return next;
      });
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) { next.delete(id); } else { next.set(id, ""); }
      return next;
    });
  }

  function setAmount(id: string, value: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      next.set(id, value);
      return next;
    });
  }

  const selectedContractors = contractors.filter((c) => selected.has(c.id));

  const totalUsd = selectedContractors.reduce((sum, c) => {
    const amt = parseFloat(selected.get(c.id) || "0");
    return sum + (isNaN(amt) ? 0 : amt);
  }, 0);

  const hasEmptyAmounts = selectedContractors.some((c) => {
    const v = selected.get(c.id) || "";
    return v === "" || parseFloat(v) <= 0 || isNaN(parseFloat(v));
  });

  const canProceed = selected.size > 0 && !hasEmptyAmounts;
  const allReady = canProceed;

  const wireCost = selected.size * 28;
  const flashFee = selected.size * 0.001;
  const savings = wireCost - flashFee;

  const handleProceed = useCallback(() => {
    if (!canProceed) {
      toast("Enter an amount for each selected contractor", "error");
      return;
    }
    setConfirming(true);
  }, [canProceed, toast]);

  async function handleConfirm() {
    setPaying(true);
    const items = selectedContractors.map((c) => ({
      contractorId: c.id,
      amountUsd: parseFloat(selected.get(c.id) || "0"),
    }));

    try {
      const res = await fetch("/api/bulk-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const data = await res.json();

      if (res.ok && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast(data.error || "Failed to create checkout", "error");
        setPaying(false);
        setConfirming(false);
      }
    } catch {
      toast("Network error", "error");
      setPaying(false);
      setConfirming(false);
    }
  }

  return (
    <div className="animate-fade-in relative z-[1] w-full">
      {/* Dot grid */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #1A1A22 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          opacity: 0.4,
          zIndex: 0,
        }}
      />
      {/* Glow orb */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: "-80px", right: "-80px",
          width: "300px", height: "300px",
          background: "radial-gradient(circle, rgba(0,217,126,0.05) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      <div className="flex gap-8 items-start">
        {/* ── LEFT COLUMN (65%) ── */}
        <div className="flex-[13_13_0%] min-w-0">
          {/* Header */}
          <div className="mb-5">
            <h1 className="font-heading font-bold text-xl text-[var(--text-primary)]">Bulk Payout</h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Select contractors, enter amounts, pay once — USDC lands in each wallet automatically.
            </p>
          </div>

          {/* Search */}
          <div className="relative mb-4 max-w-xs">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              placeholder="Search contractors..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-2 text-sm input-base w-full search-glow"
            />
          </div>

          {/* All-ready banner */}
          {allReady && (
            <div
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg mb-3 text-sm"
              style={{ background: "rgba(0,217,126,0.08)", border: "1px solid rgba(0,217,126,0.2)", color: "var(--green)" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="font-medium">
                All {selected.size} contractor{selected.size !== 1 ? "s" : ""} ready · Total: ${totalUsd.toFixed(2)} USDC
              </span>
            </div>
          )}

          {/* Table */}
          <div className="card overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-[var(--text-muted)] text-sm">Loading...</div>
            ) : contractors.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm text-[var(--text-muted)] mb-3">No contractors yet.</p>
                <button onClick={() => router.push("/contractors")} className="text-sm text-[var(--green)] hover:underline">
                  Add a contractor →
                </button>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="table-header" style={{ borderBottom: "1px solid #1A1A22" }}>
                    <th className="px-4 py-3 text-left w-12">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="w-4 h-4 cursor-pointer rounded"
                        style={{ accentColor: "var(--green)" }}
                      />
                    </th>
                    <th className="px-4 py-3 text-left font-medium">Contractor</th>
                    <th className="px-4 py-3 text-left font-medium hidden md:table-cell" style={{ width: "180px" }}>Wallet</th>
                    <th className="px-4 py-3 text-left font-medium" style={{ width: "160px" }}>Amount (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c) => {
                    const isChecked = selected.has(c.id);
                    const amount = selected.get(c.id) ?? "";
                    return (
                      <tr
                        key={c.id}
                        className="transition-all duration-150"
                        style={{
                          borderBottom: "1px solid var(--border)",
                          minHeight: "64px",
                          background: isChecked ? "rgba(0,217,126,0.06)" : undefined,
                          borderLeft: isChecked ? "3px solid #00D97E" : "3px solid transparent",
                        }}
                      >
                        <td className="px-4" style={{ height: "64px", width: "48px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleOne(c.id)}
                            className="w-4 h-4 cursor-pointer"
                            style={{ accentColor: "var(--green)" }}
                          />
                        </td>
                        <td className="px-4" style={{ height: "64px" }}>
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
                            >
                              <span className="text-[11px] font-bold" style={{ color: "var(--bg-base)" }}>
                                {getInitials(c.name)}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-[var(--text-primary)]">{c.name}</p>
                              {c.email && (
                                <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{c.email}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 hidden md:table-cell" style={{ height: "64px", width: "180px" }}>
                          <span className="font-mono-data text-[11px]" style={{ color: "#3A3A58" }}>
                            {truncateWallet(c.solana_wallet)}
                          </span>
                        </td>
                        <td className="px-4" style={{ height: "64px", width: "160px" }}>
                          {isChecked ? (
                            <div className="relative w-36">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono-data text-sm" style={{ color: "var(--text-muted)" }}>$</span>
                              <input
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(c.id, e.target.value)}
                                placeholder="0.00"
                                onClick={(e) => e.stopPropagation()}
                                autoFocus={amount === ""}
                                className="pl-6 pr-3 font-mono-data text-sm input-base w-full text-right"
                                style={{ height: "36px", background: "#0E0E12" }}
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => toggleOne(c.id)}
                              className="text-[var(--text-muted)] text-xs hover:text-[var(--text-secondary)] transition-colors"
                            >
                              —
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* ── RIGHT COLUMN (35%) ── */}
        <div className="flex-[7_7_0%] min-w-[260px] self-start sticky top-6 space-y-4">

          {/* Payout Summary */}
          <div className="card p-5">
            <div className="flex items-center gap-2 mb-5">
              <span className="text-base">⚡</span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                Payout Summary
              </p>
            </div>

            <div className="space-y-3 mb-5">
              <div className="flex justify-between items-baseline">
                <span className="text-xs" style={{ color: "var(--text-muted)" }}>Contractors selected</span>
                <span className="font-mono-data text-sm font-semibold" style={{ color: selected.size > 0 ? "var(--text-primary)" : "var(--text-muted)" }}>
                  {selected.size} / {contractors.length}
                </span>
              </div>

              <div>
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>Total amount</span>
                </div>
                <p
                  className="font-mono-data font-bold glow-green"
                  style={{
                    fontSize: "24px",
                    color: totalUsd > 0 ? "var(--green)" : "var(--text-muted)",
                    transition: "color 200ms",
                  }}
                >
                  ${totalUsd.toFixed(2)} <span className="text-xs font-normal" style={{ color: "var(--text-muted)" }}>USDC</span>
                </p>
              </div>

              {selected.size > 0 && (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Solana transfers</span>
                    <span className="font-mono-data text-xs" style={{ color: "var(--text-secondary)" }}>{selected.size}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-xs" style={{ color: "var(--text-muted)" }}>Network fee</span>
                    <span className="font-mono-data text-xs" style={{ color: "var(--green)" }}>~${flashFee.toFixed(3)}</span>
                  </div>

                  <div className="border-t pt-3" style={{ borderColor: "var(--border)" }}>
                    <div className="flex justify-between items-baseline mb-1">
                      <span className="text-xs" style={{ color: "var(--text-muted)" }}>vs Wire transfers</span>
                      <span className="font-mono-data text-xs line-through" style={{ color: "#FF5C5C" }}>~${wireCost.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs font-semibold" style={{ color: "var(--green)" }}>You save</span>
                      <span className="font-mono-data text-sm font-bold" style={{ color: "var(--green)" }}>~${savings.toFixed(2)}</span>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Pay button */}
            <button
              onClick={handleProceed}
              disabled={!canProceed}
              className="w-full font-semibold text-sm rounded-lg transition-all duration-200"
              style={{
                height: "48px",
                ...(canProceed
                  ? { background: "var(--green)", color: "#0B0F19", boxShadow: "0 0 20px rgba(0,217,126,0.35)" }
                  : { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "not-allowed" }
                ),
              }}
            >
              {canProceed
                ? `Pay $${totalUsd.toFixed(2)} to ${selected.size} contractor${selected.size !== 1 ? "s" : ""} →`
                : selected.size > 0 && hasEmptyAmounts
                  ? "Enter amounts first"
                  : "Select contractors first"}
            </button>

            {hasEmptyAmounts && selected.size > 0 && (
              <p className="text-[10px] text-center mt-2 flex items-center justify-center gap-1" style={{ color: "var(--amber)" }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                Enter amounts for all selected
              </p>
            )}
          </div>

          {/* How it works */}
          <div className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: "var(--text-muted)" }}>
              How bulk payout works
            </p>
            <div className="space-y-0">
              {[
                { icon: "☑", text: "Select contractors + set amounts" },
                { icon: "💳", text: "One Dodo checkout for total" },
                { icon: "⚡", text: "USDC sent to each wallet instantly" },
              ].map((step, i, arr) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-xs flex-shrink-0"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                    >
                      {step.icon}
                    </div>
                    {i < arr.length - 1 && (
                      <div className="w-px my-1" style={{ height: "14px", background: "var(--border)" }} />
                    )}
                  </div>
                  <p className="text-xs pb-3 pt-0.5" style={{ color: "var(--text-muted)" }}>{step.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Previous bulk payouts */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                Previous Bulk Payouts
              </p>
              {recentBulk.length > 0 && (
                <button
                  onClick={() => router.push("/payouts")}
                  className="text-[11px] hover:underline"
                  style={{ color: "var(--green)" }}
                >
                  View all →
                </button>
              )}
            </div>
            {recentBulk.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>No bulk payouts yet.</p>
            ) : (
              <div className="space-y-3">
                {recentBulk.map((b) => (
                  <div key={b.id} className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                        {b.count} contractor{b.count !== 1 ? "s" : ""} · ${b.total.toFixed(2)}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--text-muted)" }}>{formatDate(b.created_at)}</p>
                    </div>
                    <span
                      className="text-[10px] font-medium px-2 py-0.5 rounded-full flex-shrink-0"
                      style={
                        b.status === "done"
                          ? { background: "rgba(0,217,126,0.12)", color: "var(--green)" }
                          : b.status === "partial"
                            ? { background: "rgba(255,173,51,0.12)", color: "var(--amber)" }
                            : { background: "rgba(99,143,255,0.12)", color: "var(--blue)" }
                      }
                    >
                      {b.status === "done" ? "Confirmed" : b.status === "partial" ? "Partial" : "Processing"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirming && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => !paying && setConfirming(false)}
        >
          <div className="card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-[var(--border)]">
              <h2 className="font-heading font-semibold text-base text-[var(--text-primary)]">
                Confirm Bulk Payout
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                One card payment → USDC sent to each wallet automatically
              </p>
            </div>

            <div className="px-6 py-4 max-h-64 overflow-y-auto">
              <div className="space-y-2">
                {selectedContractors.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-[var(--border)] last:border-0">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
                      >
                        <span className="text-[10px] font-bold" style={{ color: "var(--bg-base)" }}>
                          {getInitials(c.name)}
                        </span>
                      </div>
                      <span className="text-sm text-[var(--text-primary)] font-medium">{c.name}</span>
                    </div>
                    <span className="font-mono-data text-sm font-semibold" style={{ color: "var(--green)" }}>
                      ${parseFloat(selected.get(c.id) || "0").toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)] rounded-b-[var(--radius)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[var(--text-muted)]">Total charged via card</span>
                <span className="font-mono-data text-lg font-bold" style={{ color: "var(--green)" }}>
                  ${totalUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setConfirming(false)} disabled={paying} className="flex-1 py-2.5 text-sm btn-secondary">
                  Cancel
                </button>
                <button onClick={handleConfirm} disabled={paying} className="flex-1 py-2.5 text-sm btn-primary">
                  {paying ? "Redirecting..." : "Pay Now"}
                </button>
              </div>
              <p className="text-[10px] text-[var(--text-muted)] text-center mt-3 flex items-center justify-center gap-1">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="var(--green)" strokeWidth="1.5" />
                  <path d="M8 12l3 3 5-5" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Settles on Solana in &lt;2s per transfer · Fee ~$0.001 each
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
