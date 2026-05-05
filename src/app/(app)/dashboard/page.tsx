"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { StatusBadge } from "@/components/status-badge";
import { truncateSig, solscanTxUrl, formatUsd, formatDate } from "@/lib/utils";
import { useToast } from "@/components/toast";

interface Payout {
  id: string;
  amount_usd: number;
  status: string;
  solana_tx_sig: string | null;
  dodo_payment_id: string | null;
  created_at: string;
  contractors: {
    name: string;
    solana_wallet: string;
    owner_id: string;
  };
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-zinc-500">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams.get("payout") === "success") {
      toast("Payment initiated! Waiting for confirmation...", "success");
    }
  }, [searchParams, toast]);

  useEffect(() => {
    fetchPayouts();
  }, []);

  async function fetchPayouts() {
    const res = await fetch("/api/payouts");
    if (res.ok) {
      setPayouts(await res.json());
    }
    setLoading(false);
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

  const totalPaid = payouts
    .filter((p) => p.status === "done")
    .reduce((sum, p) => sum + Number(p.amount_usd), 0);

  const contractorCount = new Set(
    payouts.map((p) => p.contractors?.name)
  ).size;

  const thisMonth = payouts.filter((p) => {
    const d = new Date(p.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const lastPayout = payouts[0];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link
          href="/contractors"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          New Payout
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <p className="text-sm text-zinc-500 mb-1">Total Paid Out</p>
          <p className="text-2xl font-bold">{formatUsd(totalPaid)}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <p className="text-sm text-zinc-500 mb-1">Contractors</p>
          <p className="text-2xl font-bold">{contractorCount}</p>
        </div>
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5">
          <p className="text-sm text-zinc-500 mb-1">Payouts This Month</p>
          <p className="text-2xl font-bold">{thisMonth}</p>
        </div>
      </div>

      {/* Last Payout Card */}
      {lastPayout && (
        <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-5 mb-8">
          <p className="text-sm text-zinc-500 mb-2">Last Payout</p>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">
                {lastPayout.contractors?.name} —{" "}
                {formatUsd(Number(lastPayout.amount_usd))}
              </p>
              <p className="text-xs text-zinc-500">
                {formatDate(lastPayout.created_at)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <StatusBadge status={lastPayout.status} />
              {lastPayout.solana_tx_sig && (
                <a
                  href={solscanTxUrl(lastPayout.solana_tx_sig)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-400 font-mono"
                >
                  {truncateSig(lastPayout.solana_tx_sig)}
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Payouts Table */}
      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
        <div className="px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-semibold">Recent Payouts</h2>
        </div>
        {loading ? (
          <div className="p-8 text-center text-zinc-500">Loading...</div>
        ) : payouts.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            No payouts yet. Start by adding a contractor.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-zinc-500 border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-5 py-3 font-medium">Contractor</th>
                  <th className="px-5 py-3 font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">Tx</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {payouts.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-zinc-100 dark:border-zinc-800/50 last:border-0"
                  >
                    <td className="px-5 py-3 font-medium">
                      {p.contractors?.name || "—"}
                    </td>
                    <td className="px-5 py-3">
                      {formatUsd(Number(p.amount_usd))}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3">
                      {p.solana_tx_sig ? (
                        <a
                          href={solscanTxUrl(p.solana_tx_sig)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:text-blue-400 font-mono text-xs"
                        >
                          {truncateSig(p.solana_tx_sig)}
                        </a>
                      ) : (
                        <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">
                      {formatDate(p.created_at)}
                    </td>
                    <td className="px-5 py-3">
                      {p.status === "failed" && (
                        <button
                          onClick={() => handleRetry(p.id)}
                          disabled={retrying === p.id}
                          className="text-xs text-blue-500 hover:text-blue-400 font-medium disabled:opacity-50"
                        >
                          {retrying === p.id ? "Retrying..." : "Retry"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
