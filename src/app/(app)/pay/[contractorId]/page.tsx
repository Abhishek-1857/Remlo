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
    <div className="max-w-[480px] mx-auto animate-fade-in relative z-[1]">
      {/* Back button */}
      <button
        onClick={() => router.push("/pay")}
        className="flex items-center gap-1.5 text-xs mb-5 transition-colors"
        style={{ color: 'var(--text-muted)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 5 5 12 12 19" />
        </svg>
        Back to contractors
      </button>

      {/* Contractor card */}
      <div className="card p-5 mb-4" style={{ borderColor: 'rgba(0,217,126,0.15)' }}>
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
                style={{ background: 'rgba(0,217,126,0.12)', color: 'var(--green)' }}
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
            <p className="text-[10px] text-[var(--text-muted)] mb-0.5 uppercase tracking-wide">Total paid</p>
            <p
              className="font-mono-data text-sm font-semibold"
              style={{ color: totalPaid > 0 ? 'var(--green)' : 'var(--text-muted)' }}
            >
              ${totalPaid.toFixed(2)}
            </p>
          </div>
        </div>
      </div>

      {/* Payment card */}
      <div className="card p-6">
        {/* Amount input */}
        <div className="py-6 text-center border-b border-[var(--border)] mb-5">
          <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-wider mb-4">
            Amount (USD)
          </label>
          <div className="inline-flex items-center gap-1">
            <span
              className="font-mono-data"
              style={{ fontSize: '40px', color: 'var(--text-muted)', lineHeight: 1 }}
            >
              $
            </span>
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
                fontSize: '56px',
                lineHeight: 1,
                color: amountNum > 0 ? 'var(--green)' : 'var(--text-muted)',
                width: '8ch',
                transition: 'color 200ms',
              }}
            />
          </div>

          {/* Live USDC + savings — animate in when amount > 0 */}
          <div
            className="mt-4 space-y-2"
            style={{
              opacity: amountNum > 0 ? 1 : 0,
              transform: amountNum > 0 ? 'translateY(0)' : 'translateY(6px)',
              transition: 'opacity 200ms, transform 200ms',
              pointerEvents: amountNum > 0 ? 'auto' : 'none',
            }}
          >
            <p className="font-mono-data text-sm glow-green" style={{ color: 'var(--green)' }}>
              ≈ {amountNum.toFixed(2)} USDC on Solana
            </p>
            <div className="flex items-center justify-center gap-3 text-[11px] flex-wrap">
              <span style={{ color: 'var(--green)' }}>
                This transfer: <span className="font-mono-data">~$0.001</span>
              </span>
              <span style={{ color: 'var(--text-muted)' }}>vs</span>
              <span style={{ color: '#FF5C5C' }}>
                Wire: <span className="font-mono-data line-through">~$28.00</span>
              </span>
              <span className="font-semibold" style={{ color: 'var(--green)' }}>
                Save <span className="font-mono-data">${savings.toFixed(2)}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Fee breakdown */}
        <div className="space-y-2.5 mb-5">
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Solana network fee</span>
            <span className="font-mono-data" style={{ color: 'var(--text-secondary)' }}>~$0.001</span>
          </div>
          <div className="flex justify-between text-xs items-center">
            <span style={{ color: 'var(--text-muted)' }}>Settlement time</span>
            <span className="flex items-center gap-1.5 font-mono-data" style={{ color: 'var(--green)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--green)] animate-pulse-slow inline-block flex-shrink-0" />
              &lt;2 seconds
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span style={{ color: 'var(--text-muted)' }}>Powered by</span>
            <span className="font-medium" style={{ color: 'var(--text-secondary)' }}>Dodo Payments</span>
          </div>
        </div>

        {/* Pay button */}
        <button
          onClick={handlePay}
          disabled={paying || !isValid}
          className="w-full py-3.5 text-sm font-semibold rounded-lg transition-all duration-200"
          style={
            isValid && !paying
              ? { background: 'var(--green)', color: '#0B0F19', boxShadow: '0 0 24px rgba(0,217,126,0.4)' }
              : { background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', cursor: 'not-allowed' }
          }
        >
          {paying
            ? "Redirecting to checkout..."
            : isValid
              ? `Pay $${amountNum.toFixed(2)} via Card →`
              : "Enter an amount"}
        </button>

        <p className="text-[10px] text-[var(--text-muted)] text-center mt-2.5">
          You&apos;ll be redirected to Dodo Payments secure checkout
        </p>
      </div>

      {/* Wire comparison card */}
      <div
        className="mt-4 p-4 rounded-xl"
        style={{ background: 'rgba(255,77,77,0.05)', border: '1px solid rgba(255,77,77,0.15)' }}
      >
        <div className="grid grid-cols-2 gap-6">
          <div>
            <p className="text-xs font-semibold text-[var(--text-muted)] mb-2.5">Wire Transfer</p>
            <ul className="space-y-1.5">
              {["$25–35 fee", "3–5 business days", "May get rejected"].map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-xs" style={{ color: '#FF5C5C' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold mb-2.5" style={{ color: 'var(--green)' }}>FlashPay ⚡</p>
            <ul className="space-y-1.5">
              {["~$0.001 fee", "<2 seconds", "Guaranteed on Solana"].map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--green)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
