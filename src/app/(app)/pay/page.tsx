"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

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

function truncateWallet(w: string) {
  return `${w.slice(0, 4)}...${w.slice(-4)}`;
}

export default function SendPaymentPage() {
  const router = useRouter();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [totalPaidMap, setTotalPaidMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    Promise.all([
      fetch("/api/contractors").then((r) => r.json()),
      fetch("/api/payouts").then((r) => r.json()),
    ]).then(([cs, ps]) => {
      setContractors(cs);
      const map: Record<string, number> = {};
      for (const p of ps as Payout[]) {
        if (p.status === "done") {
          map[p.contractor_id] = (map[p.contractor_id] || 0) + Number(p.amount_usd);
        }
      }
      setTotalPaidMap(map);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = contractors.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  // Reset focused index when filter changes
  useEffect(() => { setFocusedIndex(-1); }, [search]);

  function handleSelect(id: string) {
    router.push(`/pay/${id}`);
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocusedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && focusedIndex >= 0 && filtered[focusedIndex]) {
      handleSelect(filtered[focusedIndex].id);
    }
  }, [filtered, focusedIndex]);

  return (
    <div className="animate-fade-in relative z-[1] max-w-2xl" onKeyDown={handleKeyDown}>
      <p className="text-sm text-[var(--text-muted)] mb-6">
        Choose who you&apos;re paying. You&apos;ll set the amount on the next step.
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2"
          width="15" height="15" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search contractors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-9 py-2.5 text-sm input-base search-glow"
          autoFocus
        />
        {search && (
          <button
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            onClick={() => setSearch("")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Keyboard hint */}
      {filtered.length > 1 && (
        <p className="text-[10px] text-[var(--text-muted)] mb-3 font-mono-data">
          ↑↓ to navigate · Enter to select
        </p>
      )}

      {/* Contractor list */}
      {loading ? (
        <div className="py-20 text-center text-[var(--text-muted)]">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="py-20 text-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3 opacity-40">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p className="text-sm text-[var(--text-muted)] mb-3">
            {search ? `No contractors match "${search}"` : "No contractors yet."}
          </p>
          {search ? (
            <button onClick={() => setSearch("")} className="text-sm text-[var(--green)] hover:underline">
              Clear search
            </button>
          ) : (
            <button onClick={() => router.push("/contractors")} className="text-sm text-[var(--green)] hover:underline">
              Add a contractor first →
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c, idx) => {
            const initials = getInitials(c.name);
            const totalPaid = totalPaidMap[c.id] || 0;
            const isFocused = focusedIndex === idx;
            return (
              <button
                key={c.id}
                onClick={() => handleSelect(c.id)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className="w-full card p-4 flex items-center gap-4 text-left transition-all group relative overflow-hidden"
                style={isFocused ? { borderColor: 'var(--green-border)', background: 'var(--bg-elevated)' } : {}}
              >
                {/* Green left border on focus/hover */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-[3px] rounded-r transition-all duration-150"
                  style={{ background: 'var(--green)', transform: isFocused ? 'scaleY(1)' : 'scaleY(0)', transformOrigin: 'center' }}
                />

                {/* Avatar */}
                <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}>
                  <span className="text-sm font-bold" style={{ color: "var(--bg-base)" }}>{initials}</span>
                </div>

                {/* Name + email */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[var(--text-primary)] truncate">{c.name}</p>
                  <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
                    {c.email || truncateWallet(c.solana_wallet)}
                  </p>
                </div>

                {/* Total paid as pill */}
                <div className="flex-shrink-0">
                  <span
                    className="font-mono-data text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ background: totalPaid > 0 ? 'rgba(0,217,126,0.1)' : 'var(--bg-elevated)', color: totalPaid > 0 ? 'var(--green)' : 'var(--text-muted)', border: '1px solid', borderColor: totalPaid > 0 ? 'rgba(0,217,126,0.2)' : 'var(--border)' }}
                  >
                    ${totalPaid.toFixed(2)}
                  </span>
                </div>

                {/* Arrow */}
                <svg
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className="flex-shrink-0 transition-all"
                  style={isFocused ? { stroke: 'var(--green)', transform: 'translateX(2px)' } : {}}
                >
                  <line x1="5" y1="12" x2="19" y2="12" />
                  <polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
