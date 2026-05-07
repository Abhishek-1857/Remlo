"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";
import { WalletAddress } from "@/components/wallet-address";

interface Contractor {
  id: string;
  name: string;
  email: string | null;
  solana_wallet: string;
}

interface Payout {
  contractor_id: string;
  amount_usd: number;
  status: string;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

const WIRE_FEE = 28.0;
const FLASH_FEE = 0.001;

export default function PayPage({
  params,
}: {
  params: { contractorId: string };
}) {
  const { contractorId } = params;
  const router = useRouter();
  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    Promise.all([
      fetch("/api/contractors").then((r) => r.json()),
      fetch("/api/payouts").then((r) => r.json()),
    ]).then(([cs, ps]: [Contractor[], Payout[]]) => {
      const found = (cs as Contractor[]).find((c) => c.id === contractorId) || null;
      setContractor(found);
      const paid = (ps as Payout[])
        .filter((p) => p.contractor_id === contractorId && p.status === "done")
        .reduce((s, p) => s + Number(p.amount_usd), 0);
      setTotalPaid(paid);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [contractorId]);

  async function handlePay() {
    const amountNum = parseFloat(amount);
    if (!amountNum || amountNum < 1 || amountNum > 10) {
      toast("Amount must be between $1 and $10", "error");
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
    return <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">Loading...</div>;
  }

  if (!contractor) {
    return <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">Contractor not found.</div>;
  }

  const initials = getInitials(contractor.name);
  const amountNum = parseFloat(amount) || 0;
  const isValid = amountNum >= 1 && amountNum <= 10;
  const savings = WIRE_FEE - FLASH_FEE;

  return (
    <div className="animate-fade-in relative z-[1] w-full">
      {/* Dot grid texture */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle, #1A1A22 1px, transparent 1px)",
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
          background: "radial-gradient(circle, rgba(0,217,126,0.06) 0%, transparent 70%)",
          zIndex: 0,
        }}
      />

      {/* Back button */}
      <button
        onClick={() => router.push("/pay")}
        className="flex items-center gap-1.5 text-xs mb-5 transition-colors"
        style={{ color: "var(--text-muted)" }}
        onMouseEnter={(e) => (e.currentTarget.style.color = "var(--text-primary)")}
        onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 5 5 12 12 19" />
        </svg>
        Back to contractors
      </button>

      <div className="flex gap-8 items-start">
        {/* ── LEFT COLUMN (55%) ── */}
        <div className="flex-[11_11_0%] min-w-0">
          {/* Contractor card */}
          <div className="card p-5 mb-4" style={{ borderColor: "rgba(0,217,126,0.15)" }}>
            <div className="flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
              >
                <span className="text-base font-bold" style={{ color: "var(--bg-base)" }}>{initials}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="font-semibold text-[var(--text-primary)]">{contractor.name}</p>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded-full"
                    style={{ background: "rgba(0,217,126,0.12)", color: "var(--green)" }}
                  >
                    Active
                  </span>
                </div>
                {contractor.email && (
                  <p className="text-xs text-[var(--text-muted)] mb-1">{contractor.email}</p>
                )}
                <WalletAddress address={contractor.solana_wallet} />
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-[10px] uppercase tracking-wide mb-0.5" style={{ color: "var(--text-muted)" }}>Total paid</p>
                <p
                  className="font-mono-data text-sm font-semibold"
                  style={{ color: totalPaid > 0 ? "var(--green)" : "var(--text-muted)" }}
                >
                  ${totalPaid.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Amount input card */}
          <div
            className="card p-6 mb-4 transition-all duration-300"
            style={{
              minHeight: "280px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              boxShadow: amountNum > 0
                ? "0 0 0 1px rgba(0,217,126,0.3), 0 0 40px rgba(0,217,126,0.08)"
                : undefined,
            }}
          >
            <label className="block text-[10px] uppercase tracking-wider text-center mb-6" style={{ color: "var(--text-muted)" }}>
              Amount (USD)
            </label>

            <div className="flex items-center justify-center gap-1">
              <span className="font-mono-data" style={{ fontSize: "40px", lineHeight: 1, color: "var(--text-muted)" }}>$</span>
              <input
                type="number"
                min="1"
                max="10"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
                className="font-mono-data bg-transparent border-none outline-none text-center placeholder:text-[var(--border-bright)] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                style={{
                  fontSize: "64px",
                  lineHeight: 1,
                  width: "8ch",
                  caretColor: "var(--green)",
                  color: amountNum > 0 ? "var(--green)" : "var(--text-muted)",
                  transition: "color 200ms",
                }}
              />
            </div>

            {/* Live display — fades in when amount > 0 */}
            <div
              className="text-center mt-6 space-y-1"
              style={{
                opacity: amountNum > 0 ? 1 : 0,
                transform: amountNum > 0 ? "translateY(0)" : "translateY(8px)",
                transition: "opacity 250ms, transform 250ms",
                pointerEvents: amountNum > 0 ? "auto" : "none",
              }}
            >
              <p className="font-mono-data text-sm glow-green" style={{ color: "var(--green)" }}>
                = {amountNum.toFixed(2)} USDC · saves ~${savings.toFixed(2)} vs wire
              </p>
            </div>
          </div>

          {/* Fee breakdown */}
          <div className="card p-4 mb-4 space-y-2.5">
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--text-muted)" }}>Solana network fee</span>
              <span className="font-mono-data" style={{ color: "var(--text-secondary)" }}>~$0.001</span>
            </div>
            <div className="flex justify-between text-xs items-center">
              <span style={{ color: "var(--text-muted)" }}>Settlement time</span>
              <span className="flex items-center gap-1.5 font-mono-data" style={{ color: "var(--green)" }}>
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse-slow inline-block flex-shrink-0" />
                &lt;2 seconds
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span style={{ color: "var(--text-muted)" }}>Powered by</span>
              <span className="font-medium" style={{ color: "var(--text-secondary)" }}>Dodo Payments</span>
            </div>
          </div>

          {/* Pay button */}
          <button
            onClick={handlePay}
            disabled={paying || !isValid}
            className="w-full py-3.5 text-sm font-semibold rounded-lg transition-all duration-200"
            style={
              isValid && !paying
                ? { background: "var(--green)", color: "#0B0F19", boxShadow: "0 0 24px rgba(0,217,126,0.4)" }
                : { background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)", cursor: "not-allowed" }
            }
          >
            {paying
              ? "Redirecting to checkout..."
              : isValid
                ? `Pay $${amountNum.toFixed(2)} via Card →`
                : "Enter an amount"}
          </button>

          <p className="text-[10px] text-center mt-2" style={{ color: "var(--text-muted)" }}>
            You&apos;ll be redirected to Dodo Payments secure checkout
          </p>
        </div>

        {/* ── RIGHT COLUMN (45%) ── */}
        <div className="flex-[9_9_0%] min-w-[260px] self-start sticky top-6 space-y-4">

          {/* Transfer Summary — animates in when amount > 0 */}
          <div
            className="card p-5 transition-all duration-300"
            style={{
              opacity: amountNum > 0 ? 1 : 0,
              transform: amountNum > 0 ? "translateY(0)" : "translateY(-8px)",
              pointerEvents: amountNum > 0 ? "auto" : "none",
              borderLeftColor: "var(--green)",
              borderLeftWidth: "3px",
              background: "rgba(0,217,126,0.03)",
            }}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: "var(--text-muted)" }}>
              You&apos;re sending
            </p>
            <p className="font-mono-data font-bold glow-green mb-4" style={{ fontSize: "28px", color: "var(--green)" }}>
              ${amountNum.toFixed(2)} USDC
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>To</span>
                <span className="font-medium truncate max-w-[160px] text-right" style={{ color: "var(--text-secondary)" }}>
                  {contractor.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Network</span>
                <span className="font-mono-data" style={{ color: "var(--text-secondary)" }}>Solana Devnet</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Fee</span>
                <span className="font-mono-data" style={{ color: "var(--green)" }}>~$0.001</span>
              </div>
              <div className="flex justify-between">
                <span style={{ color: "var(--text-muted)" }}>Estimated arrival</span>
                <span className="font-mono-data" style={{ color: "var(--green)" }}>&lt;2 seconds</span>
              </div>
            </div>
          </div>

          {/* Wire Transfer Comparison */}
          <div className="card p-5" style={{ background: "rgba(255,77,77,0.03)", borderColor: "rgba(255,77,77,0.15)" }}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: "var(--text-muted)" }}>
              Why not wire transfer?
            </p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--text-muted)" }}>Wire Transfer</p>
                <ul className="space-y-1.5">
                  {["$25–35 fee", "3–5 business days", "May get rejected"].map((item) => (
                    <li key={item} className="flex items-center gap-1.5 text-xs" style={{ color: "#FF5C5C" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: "var(--green)" }}>FlashPay ⚡</p>
                <ul className="space-y-1.5">
                  {["~$0.001 fee", "<2 seconds", "Guaranteed on Solana"].map((item) => (
                    <li key={item} className="flex items-center gap-1.5 text-xs" style={{ color: "var(--green)" }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div
              className="rounded-lg px-3 py-2 text-center transition-all duration-300"
              style={{ background: "rgba(0,217,126,0.08)", border: "1px solid rgba(0,217,126,0.15)" }}
            >
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>You save</p>
              <p
                key={Math.floor(amountNum)}
                className="font-mono-data font-bold text-lg animate-fade-in glow-green"
                style={{ color: "var(--green)" }}
              >
                ${savings.toFixed(3)} on this transfer
              </p>
            </div>
          </div>

          {/* How it works */}
          <div className="card p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.1em] mb-4" style={{ color: "var(--text-muted)" }}>
              How it works
            </p>
            <div className="space-y-0">
              {[
                "You pay by card via Dodo",
                "FlashPay converts to USDC",
                "Lands in wallet in <2s",
              ].map((step, i, arr) => (
                <div key={i} className="flex gap-3 items-start">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
                    >
                      <span className="text-[9px] font-mono-data" style={{ color: "var(--text-muted)" }}>{i + 1}</span>
                    </div>
                    {i < arr.length - 1 && (
                      <div className="w-px my-1" style={{ height: "16px", background: "var(--border)" }} />
                    )}
                  </div>
                  <p className="text-xs pb-3 pt-0.5" style={{ color: "var(--text-muted)" }}>{step}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Security note */}
          <p className="text-[11px] text-center px-2" style={{ color: "var(--text-muted)", opacity: 0.6 }}>
            🔒 Payments processed by Dodo Payments. Transfers secured by Solana blockchain.
          </p>
        </div>
      </div>
    </div>
  );
}
