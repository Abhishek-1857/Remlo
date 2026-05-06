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

function getInitials(name: string) {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function truncateWallet(wallet: string) {
  return `${wallet.slice(0, 4)}...${wallet.slice(-4)}`;
}

export default function BulkPayoutPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Map<string, string>>(new Map()); // id → amountUsd string
  const [confirming, setConfirming] = useState(false);
  const [paying, setPaying] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    fetch("/api/contractors")
      .then((r) => r.json())
      .then((data) => {
        setContractors(data);
        setLoading(false);
      });
  }, []);

  const filtered = contractors.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.email?.toLowerCase().includes(search.toLowerCase()) ?? false)
  );

  const allSelected =
    filtered.length > 0 && filtered.every((c) => selected.has(c.id));

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
        filtered.forEach((c) => {
          if (!next.has(c.id)) next.set(c.id, "");
        });
        return next;
      });
    }
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.set(id, "");
      }
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
    <div className="animate-fade-in relative z-[1]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-heading font-bold text-xl text-[var(--text-primary)]">Bulk Payout</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          Select contractors, enter amounts, pay once — USDC lands in each wallet automatically.
        </p>
      </div>

      {/* Search */}
      <div className="relative mb-4 max-w-xs">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]"
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search contractors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8 pr-3 py-2 text-sm input-base w-full"
        />
      </div>

      {/* Table */}
      <div className="card overflow-hidden" style={{ paddingBottom: selected.size > 0 ? "80px" : "0" }}>
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
              <tr className="table-header border-b border-[var(--border)]">
                <th className="px-5 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 accent-[var(--green)] cursor-pointer"
                  />
                </th>
                <th className="px-5 py-3 text-left font-medium">Contractor</th>
                <th className="px-5 py-3 text-left font-medium hidden md:table-cell">Wallet</th>
                <th className="px-5 py-3 text-left font-medium">Amount (USD)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => {
                const isChecked = selected.has(c.id);
                const amount = selected.get(c.id) ?? "";
                return (
                  <tr
                    key={c.id}
                    className={`table-row transition-colors ${isChecked ? "bg-[var(--green-dim)]" : ""}`}
                  >
                    <td className="px-5 py-3.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleOne(c.id)}
                        className="w-4 h-4 accent-[var(--green)] cursor-pointer"
                      />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
                        >
                          <span className="text-[11px] font-bold" style={{ color: "var(--bg-base)" }}>
                            {getInitials(c.name)}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-[var(--text-primary)]">{c.name}</p>
                          {c.email && (
                            <p className="text-[11px] text-[var(--text-muted)]">{c.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <span className="font-mono-data text-[11px] text-[var(--text-muted)]">
                        {truncateWallet(c.solana_wallet)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {isChecked ? (
                        <div className="relative w-36">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono-data text-sm">$</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={amount}
                            onChange={(e) => setAmount(c.id, e.target.value)}
                            placeholder="0.00"
                            className="pl-6 pr-3 py-2 text-sm font-mono-data input-base w-full"
                            onClick={(e) => e.stopPropagation()}
                            autoFocus={amount === ""}
                          />
                        </div>
                      ) : (
                        <span className="text-[var(--text-muted)] text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Sticky bottom bar */}
      {selected.size > 0 && (
        <div
          className="fixed bottom-0 left-[200px] right-0 border-t border-[var(--border)] z-50"
          style={{ background: "var(--bg-surface)" }}
        >
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.08em] font-medium">
                  Selected
                </p>
                <p className="font-mono-data font-semibold text-[var(--text-primary)]">
                  {selected.size} contractor{selected.size !== 1 ? "s" : ""}
                </p>
              </div>
              <div className="w-px h-8 bg-[var(--border)]" />
              <div>
                <p className="text-xs text-[var(--text-muted)] uppercase tracking-[0.08em] font-medium">
                  Total
                </p>
                <p className="font-mono-data font-semibold text-[var(--green)]">
                  ${totalUsd.toFixed(2)}
                </p>
              </div>
              {hasEmptyAmounts && (
                <span className="text-xs text-[var(--amber)] flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                    <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
                  </svg>
                  Enter amounts for all selected
                </span>
              )}
            </div>
            <button
              onClick={handleProceed}
              disabled={!canProceed}
              className="btn-primary px-6 py-2.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Proceed to Payment →
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirming && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={() => !paying && setConfirming(false)}
        >
          <div
            className="card w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
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
                    <span className="font-mono-data text-sm text-[var(--green)] font-semibold">
                      ${parseFloat(selected.get(c.id) || "0").toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="px-6 py-4 border-t border-[var(--border)] bg-[var(--bg-base)] rounded-b-[var(--radius)]">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-[var(--text-muted)]">Total charged via card</span>
                <span className="font-mono-data text-lg font-bold text-[var(--green)]">
                  ${totalUsd.toFixed(2)}
                </span>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setConfirming(false)}
                  disabled={paying}
                  className="flex-1 py-2.5 text-sm btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={paying}
                  className="flex-1 py-2.5 text-sm btn-primary"
                >
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
