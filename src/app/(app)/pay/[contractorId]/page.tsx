"use client";

import { useEffect, useState, useCallback, use } from "react";
import { useToast } from "@/components/toast";
import { truncateSig, solscanTxUrl, formatUsd } from "@/lib/utils";

interface Contractor {
  id: string;
  name: string;
  email: string | null;
  solana_wallet: string;
}

interface Payout {
  id: string;
  status: string;
  solana_tx_sig: string | null;
  amount_usd: number;
}

export default function PayPage({
  params,
}: {
  params: Promise<{ contractorId: string }>;
}) {
  const { contractorId } = use(params);
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [completedPayout, setCompletedPayout] = useState<Payout | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetch(`/api/contractors`)
      .then((r) => r.json())
      .then((data: Contractor[]) => {
        const c = data.find((c) => c.id === contractorId);
        setContractor(c || null);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [contractorId]);

  const pollForCompletion = useCallback(() => {
    setPolling(true);

    const interval = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/payouts?contractorId=${contractorId}`
        );
        if (!res.ok) return;
        const payouts: Payout[] = await res.json();
        const latest = payouts[0];

        if (latest && (latest.status === "done" || latest.status === "failed")) {
          clearInterval(interval);
          setPolling(false);

          if (latest.status === "done") {
            setCompletedPayout(latest);
            setShowConfetti(true);
            toast("USDC sent successfully!", "success");
            setTimeout(() => setShowConfetti(false), 5000);
          } else {
            toast("Payout failed — you can retry from the dashboard", "error");
          }
        }
      } catch {
        // keep polling
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [contractorId, toast]);

  async function handlePay() {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 1 || amountNum > 10000) {
      toast("Amount must be between $1 and $10,000", "error");
      return;
    }

    setPaying(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contractorId, amountUsd: amountNum }),
      });

      const data = await res.json();

      if (res.ok && data.checkout_url) {
        window.location.href = data.checkout_url;
      } else {
        toast(data.error || "Failed to create checkout", "error");
        setPaying(false);
      }
    } catch {
      toast("Network error", "error");
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Loading...
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="flex items-center justify-center py-20 text-zinc-500">
        Contractor not found.
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {showConfetti && <Confetti />}

      <h1 className="text-2xl font-bold mb-8">Pay Contractor</h1>

      <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6">
        <div className="mb-6">
          <p className="text-sm text-zinc-500 mb-1">Contractor</p>
          <p className="font-semibold text-lg">{contractor.name}</p>
        </div>

        <div className="mb-6">
          <p className="text-sm text-zinc-500 mb-1">Solana Wallet</p>
          <p className="font-mono text-sm break-all text-zinc-600 dark:text-zinc-400">
            {contractor.solana_wallet}
          </p>
        </div>

        {completedPayout ? (
          <div className="border border-green-200 dark:border-green-800 rounded-lg p-5 bg-green-50 dark:bg-green-900/20">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-green-600 text-lg">✓</span>
              <p className="font-semibold text-green-800 dark:text-green-300">
                Payment Complete
              </p>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
              {formatUsd(Number(completedPayout.amount_usd))} in USDC sent
              successfully.
            </p>
            {completedPayout.solana_tx_sig && (
              <a
                href={solscanTxUrl(completedPayout.solana_tx_sig)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-500 hover:text-blue-400 font-mono"
              >
                View on Solscan →{" "}
                {truncateSig(completedPayout.solana_tx_sig)}
              </a>
            )}
          </div>
        ) : (
          <>
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400">
                  $
                </span>
                <input
                  type="number"
                  min="1"
                  max="10000"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100.00"
                  className="w-full pl-7 pr-3 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-xs text-zinc-400 mt-1.5">
                Min $1 · Max $10,000 · Settled as USDC on Solana
              </p>
            </div>

            {polling ? (
              <div className="text-center py-4">
                <div className="inline-flex items-center gap-2 text-sm text-blue-500">
                  <svg
                    className="animate-spin h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Processing USDC transfer on Solana...
                </div>
                <p className="text-xs text-zinc-400 mt-2">
                  This usually takes a few seconds
                </p>
              </div>
            ) : (
              <div className="flex gap-3">
                <button
                  onClick={handlePay}
                  disabled={paying || !amount}
                  className="flex-1 py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {paying ? "Redirecting..." : "Pay via Card"}
                </button>
                <button
                  onClick={() => {
                    pollForCompletion();
                  }}
                  className="px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-sm font-medium hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                >
                  Check Status
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Confetti() {
  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute animate-confetti"
          style={{
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            animationDuration: `${2 + Math.random() * 3}s`,
            backgroundColor: ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"][
              i % 5
            ],
            width: `${6 + Math.random() * 6}px`,
            height: `${6 + Math.random() * 6}px`,
            borderRadius: Math.random() > 0.5 ? "50%" : "0",
          }}
        />
      ))}
    </div>
  );
}
