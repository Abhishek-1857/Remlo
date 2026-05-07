"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { TxHash } from "@/components/tx-hash";

interface Payout {
  id: string;
  amount_usd: number;
  status: string;
  solana_tx_sig: string | null;
  dodo_payment_id: string | null;
  bulk_payout_id: string | null;
  settlement_ms: number | null;
  error_message?: string | null;
  created_at: string;
  contractors: {
    name: string;
    email: string | null;
    solana_wallet: string;
    owner_id: string;
  };
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between py-3 border-b border-[var(--border)] last:border-0">
      <span className="text-xs text-[var(--text-muted)] flex-shrink-0 w-36">{label}</span>
      <span className={`text-sm text-[var(--text-primary)] text-right break-all ${mono ? "font-mono-data" : ""}`}>
        {value}
      </span>
    </div>
  );
}

export default function PayoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [payout, setPayout] = useState<Payout | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/payouts/${params.payoutId}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => { if (data) { setPayout(data); setLoading(false); } });
  }, [params.payoutId]);

  if (loading) {
    return <div className="py-20 text-center text-[var(--text-muted)] text-sm">Loading...</div>;
  }

  if (notFound || !payout) {
    return (
      <div className="py-20 text-center">
        <p className="text-sm text-[var(--text-muted)] mb-3">Payout not found.</p>
        <button onClick={() => router.push("/payouts")} className="text-sm text-[var(--green)] hover:underline">
          ← Back to Payouts
        </button>
      </div>
    );
  }

  const date = new Date(payout.created_at).toLocaleString("en-US", {
    month: "long", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  const solscanUrl = payout.solana_tx_sig
    ? `https://solscan.io/tx/${payout.solana_tx_sig}?cluster=devnet`
    : null;

  return (
    <div className="animate-fade-in relative z-[1]">
      {/* Back */}
      <button
        onClick={() => router.push("/payouts")}
        className="flex items-center gap-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors mb-6"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
        </svg>
        All Payouts
      </button>

      {/* Amount hero */}
      <div className="card p-6 mb-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.08em] font-medium mb-1">Amount</p>
            <p className="text-[42px] font-mono-data font-bold text-[var(--green)] leading-none">
              ${Number(payout.amount_usd).toFixed(2)}
            </p>
            <p className="text-xs text-[var(--text-muted)] mt-1">USDC · Solana devnet</p>
          </div>
          <StatusBadge status={payout.status} />
        </div>
        {payout.status === "done" && payout.settlement_ms && (
          <div className="mt-3">
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-mono-data font-semibold glow-green"
              style={{ background: "rgba(0,230,160,0.12)", color: "var(--green)", border: "1px solid rgba(0,230,160,0.2)" }}
            >
              ⚡ Settled in {(payout.settlement_ms / 1000).toFixed(1)}s
            </span>
          </div>
        )}
        <p className="text-xs text-[var(--text-muted)] mt-3">{date}</p>
        {payout.error_message && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs text-[var(--red)]" style={{ background: "var(--red-dim)" }}>
            Error: {payout.error_message}
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Contractor */}
        <div className="card p-5">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] font-medium mb-3">Contractor</p>
          <DetailRow label="Name" value={payout.contractors?.name || "—"} />
          <DetailRow label="Email" value={payout.contractors?.email || "—"} />
          <DetailRow label="Solana Wallet" value={payout.contractors?.solana_wallet || "—"} mono />
        </div>

        {/* Transaction */}
        <div className="card p-5">
          <p className="text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] font-medium mb-3">Transaction</p>
          <DetailRow
            label="Tx Hash"
            value={
              payout.solana_tx_sig
                ? <TxHash hash={payout.solana_tx_sig} />
                : <span className="text-[var(--text-muted)]">—</span>
            }
          />
          <DetailRow
            label="Solscan"
            value={
              solscanUrl
                ? <a href={solscanUrl} target="_blank" rel="noopener noreferrer" className="text-[var(--green)] hover:underline text-xs">View on Solscan →</a>
                : <span className="text-[var(--text-muted)]">—</span>
            }
          />
          <DetailRow label="Network Fee" value={payout.solana_tx_sig ? "~$0.001" : "—"} />
          <DetailRow
            label="Settlement Speed"
            value={
              payout.settlement_ms
                ? <span className="font-mono-data glow-green" style={{ color: "var(--green)" }}>⚡ {(payout.settlement_ms / 1000).toFixed(1)}s</span>
                : <span className="font-mono-data" style={{ color: "var(--green)" }}>&lt;2s</span>
            }
          />
          <DetailRow label="Network" value="Solana devnet" />
          {payout.dodo_payment_id && (
            <DetailRow label="Payment ID" value={payout.dodo_payment_id} mono />
          )}
          {payout.bulk_payout_id && (
            <DetailRow label="Bulk Payout ID" value={payout.bulk_payout_id} mono />
          )}
        </div>
      </div>
    </div>
  );
}
