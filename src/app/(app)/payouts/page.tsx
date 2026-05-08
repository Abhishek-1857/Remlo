"use client";

import { useEffect, useState } from "react";
import { StatusBadge } from "@/components/status-badge";
import { formatDate } from "@/lib/utils";

interface Payout {
  id: string;
  amount_usd: number;
  status: string;
  solana_tx_sig: string | null;
  bulk_payout_id: string | null;
  settlement_ms: number | null;
  created_at: string;
  contractor_id: string;
  contractors: { name: string; solana_wallet: string; owner_id: string };
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function truncate(s: string, n: number) {
  return s.length > n ? `${s.slice(0, n)}...` : s;
}

export default function PayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedTx, setCopiedTx] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 15;

  useEffect(() => {
    fetch("/api/payouts")
      .then((r) => r.json())
      .then((data) => { setPayouts(data); setLoading(false); });
  }, []);

  async function handleExportCSV() {
    setExporting(true);
    const res = await fetch("/api/payouts/export");
    if (res.ok) {
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `payzap-payouts-${new Date().toISOString().split("T")[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    }
    setExporting(false);
  }

  async function copyTx(hash: string) {
    await navigator.clipboard.writeText(hash);
    setCopiedTx(hash);
    setTimeout(() => setCopiedTx(null), 2000);
  }

  const filtered = payouts
    .filter((p) => (p.contractors?.name || "").toLowerCase().includes(search.toLowerCase()))
    .filter((p) => filter === "all" ? true : p.status === filter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * perPage, currentPage * perPage);

  const totalDone = payouts
    .filter((p) => p.status === "done")
    .reduce((s, p) => s + Number(p.amount_usd), 0);

  const filterOptions: { value: string; label: string }[] = [
    { value: "all", label: "All" },
    { value: "pending", label: "Pending" },
    { value: "processing", label: "Processing" },
    { value: "done", label: "Confirmed" },
    { value: "failed", label: "Failed" },
  ];

  return (
    <div className="animate-fade-in relative z-[1]">
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search by contractor..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm input-base search-glow"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setFilter(opt.value); setPage(1); }}
              className="px-3 py-1 text-xs rounded-md font-medium transition-all"
              style={
                filter === opt.value
                  ? { background: 'var(--green)', color: '#080C14' }
                  : { color: 'var(--text-muted)', background: 'transparent' }
              }
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Total + Export */}
        <div className="ml-auto flex items-center gap-3">
          <div className="text-sm text-[var(--text-muted)]">
            <span className="font-mono-data text-[20px] glow-green" style={{ color: 'var(--green)', fontWeight: 700 }}>${totalDone.toFixed(2)}</span>
            <span className="ml-1.5 text-xs">total paid out</span>
          </div>
          <button
            onClick={handleExportCSV}
            disabled={exporting}
            className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
            style={{ border: "1px solid var(--border-bright)", color: "var(--text-muted)", background: "transparent" }}
            onMouseEnter={(e) => { if (!exporting) { (e.currentTarget as HTMLElement).style.color = "var(--green)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--green)"; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-muted)"; (e.currentTarget as HTMLElement).style.borderColor = "var(--border-bright)"; }}
          >
            {exporting ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="animate-spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            )}
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-[var(--text-muted)] text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40">
              <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
            </svg>
            <p className="text-sm text-[var(--text-muted)]">{search || filter !== "all" ? "No payouts match your filters." : "No payouts yet."}</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="table-header border-b border-[var(--border)]">
                <th className="px-5 py-3 text-left font-medium">Contractor</th>
                <th className="px-5 py-3 text-left font-medium">Amount</th>
                <th className="px-5 py-3 text-left font-medium w-[120px]">Status</th>
                <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Date</th>
                <th className="px-5 py-3 text-right font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((p) => {
                const name = p.contractors?.name || "Unknown";
                const initials = getInitials(name);
                const isExpanded = expandedId === p.id;
                const solscanUrl = p.solana_tx_sig ? `https://solscan.io/tx/${p.solana_tx_sig}?cluster=devnet` : null;
                return (
                  <>
                    <tr
                      key={p.id}
                      className="table-row cursor-pointer"
                      style={isExpanded ? { background: 'rgba(0,230,160,0.03)', borderLeft: '2px solid #00E6A0' } : {}}
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
                          >
                            <span className="text-[10px] font-bold" style={{ color: "var(--bg-base)" }}>{initials}</span>
                          </div>
                          <span className="font-medium text-[var(--text-primary)]">{name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 font-mono-data text-[var(--green)]">
                        ${Number(p.amount_usd).toFixed(2)}
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
                      <td className="px-5 py-3.5 text-[var(--text-muted)] text-xs hidden md:table-cell">
                        {formatDate(p.created_at)}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <svg
                          width="14" height="14" viewBox="0 0 24 24" fill="none"
                          stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                          className="row-arrow inline-block transition-transform duration-200"
                          style={{ transform: isExpanded ? 'rotate(90deg)' : 'none', opacity: isExpanded ? 1 : undefined }}
                        >
                          <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                        </svg>
                      </td>
                    </tr>

                    {/* Expanded row */}
                    {isExpanded && (
                      <tr key={`${p.id}-expanded`} className="payout-expanded-row">
                        <td colSpan={5} className="px-5 pb-4 pt-1" style={{ background: 'rgba(0,230,160,0.03)', borderLeft: '2px solid #00E6A0' }}>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 py-3">
                            {/* TX Hash */}
                            <div>
                              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] mb-1.5 font-medium">TX Hash</p>
                              {p.solana_tx_sig ? (
                                <div className="flex items-center gap-2">
                                  <span className="font-mono-data text-xs text-[var(--text-secondary)]">{truncate(p.solana_tx_sig, 16)}</span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); copyTx(p.solana_tx_sig!); }}
                                    className="p-1 rounded hover:bg-[var(--bg-hover)] transition-colors flex-shrink-0"
                                    title="Copy TX hash"
                                  >
                                    {copiedTx === p.solana_tx_sig ? (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 12 10 16 18 8" /></svg>
                                    ) : (
                                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                                    )}
                                  </button>
                                </div>
                              ) : <span className="text-[var(--text-muted)] text-xs">—</span>}
                            </div>

                            {/* Wallet */}
                            <div>
                              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] mb-1.5 font-medium">Contractor Wallet</p>
                              <span className="font-mono-data text-xs text-[var(--text-secondary)]">
                                {p.contractors?.solana_wallet ? `${p.contractors.solana_wallet.slice(0, 8)}...${p.contractors.solana_wallet.slice(-8)}` : "—"}
                              </span>
                            </div>

                            {/* Details */}
                            <div>
                              <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] mb-1.5 font-medium">Settlement</p>
                              <div className="space-y-0.5">
                                <p className="text-xs text-[var(--text-secondary)]">Network fee: <span className="font-mono-data">~$0.001</span></p>
                                <p className="text-xs text-[var(--text-secondary)]">Time:{" "}
                                  <span className="font-mono-data" style={{ color: "var(--green)" }}>
                                    {p.settlement_ms ? `⚡ ${(p.settlement_ms / 1000).toFixed(1)}s` : "<2s"}
                                  </span>
                                </p>
                                <p className="text-xs text-[var(--text-secondary)]">Network: <span>Solana devnet</span></p>
                              </div>
                            </div>
                          </div>

                          {/* Solscan button */}
                          {solscanUrl && (
                            <a
                              href={solscanUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 text-xs rounded-lg font-medium transition-colors"
                              style={{ background: 'rgba(0,230,160,0.1)', color: 'var(--green)', border: '1px solid rgba(0,230,160,0.2)' }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,230,160,0.18)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(0,230,160,0.1)')}
                            >
                              View on Solscan
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                              </svg>
                            </a>
                          )}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {filtered.length > perPage && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-[var(--border)]">
            <p className="text-xs text-[var(--text-muted)]">
              Showing {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filtered.length)} of {filtered.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-2.5 py-1 text-xs rounded-md font-medium transition-colors disabled:opacity-30"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                .reduce<(number | "...")[]>((acc, p, i, arr) => {
                  if (i > 0 && p - (arr[i - 1]) > 1) acc.push("...");
                  acc.push(p);
                  return acc;
                }, [])
                .map((p, i) =>
                  p === "..." ? (
                    <span key={`dots-${i}`} className="px-1 text-xs text-[var(--text-muted)]">...</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p as number)}
                      className="w-8 h-8 text-xs rounded-md font-medium transition-all"
                      style={
                        p === currentPage
                          ? { background: "var(--green)", color: "#080C14" }
                          : { color: "var(--text-muted)", border: "1px solid var(--border)" }
                      }
                    >
                      {p}
                    </button>
                  )
                )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-2.5 py-1 text-xs rounded-md font-medium transition-colors disabled:opacity-30"
                style={{ color: "var(--text-muted)", border: "1px solid var(--border)" }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
