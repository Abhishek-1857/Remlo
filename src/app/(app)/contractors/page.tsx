"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useToast } from "@/components/toast";
import { createClient } from "@/lib/supabase/browser";

interface Contractor {
  id: string;
  name: string;
  email: string | null;
  solana_wallet: string;
  created_at: string;
}

interface Invite {
  id: string;
  token: string;
  company_name: string | null;
  invite_url?: string;
}

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function truncateWallet(w: string) {
  if (w.length <= 12) return w;
  return `${w.slice(0, 6)}...${w.slice(-6)}`;
}

function daysAgo(dateStr: string): string {
  const d = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  return `${d} days ago`;
}

export default function ContractorsPage() {
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [totalPaidMap, setTotalPaidMap] = useState<Record<string, number>>({});
  const [lastPaidMap, setLastPaidMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [formError, setFormError] = useState("");
  const [copiedWalletId, setCopiedWalletId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteCompanyName, setInviteCompanyName] = useState("");
  const [inviteGenerating, setInviteGenerating] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<Invite | null>(null);
  const [copied, setCopied] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchContractors();
    fetchPayouts();
  }, []);

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Realtime subscription for new contractors
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("contractors-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "contractors" }, (payload) => {
        const incoming = payload.new as Contractor;
        setContractors((prev) => {
          if (prev.some((c) => c.id === incoming.id)) return prev;
          return [incoming, ...prev];
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchContractors() {
    const res = await fetch("/api/contractors");
    if (res.ok) setContractors(await res.json());
    setLoading(false);
  }

  async function fetchPayouts() {
    const res = await fetch("/api/payouts");
    if (res.ok) {
      const payouts = await res.json();
      const totalMap: Record<string, number> = {};
      const lastMap: Record<string, string> = {};
      for (const p of payouts) {
        if (p.status === "done") {
          totalMap[p.contractor_id] = (totalMap[p.contractor_id] || 0) + Number(p.amount_usd);
          if (!lastMap[p.contractor_id] || p.created_at > lastMap[p.contractor_id]) {
            lastMap[p.contractor_id] = p.created_at;
          }
        }
      }
      setTotalPaidMap(totalMap);
      setLastPaidMap(lastMap);
    }
  }

  function openInviteModal() {
    setShowInviteModal(true);
    setGeneratedInvite(null);
    setInviteCompanyName("");
    setCopied(false);
  }

  async function handleGenerateInvite() {
    setInviteGenerating(true);
    setGeneratedInvite(null);
    const res = await fetch("/api/invites/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company_name: inviteCompanyName }),
    });
    const data = await res.json();
    if (res.ok && data.invite) {
      const appUrl = window.location.origin;
      setGeneratedInvite({ ...data.invite, invite_url: `${appUrl}/invite/${data.invite.token}` });
      setCopied(false);
    } else {
      toast(data.error || "Failed to generate invite", "error");
    }
    setInviteGenerating(false);
  }

  async function handleCopy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function copyWallet(id: string, w: string) {
    await navigator.clipboard.writeText(w);
    setCopiedWalletId(id);
    setTimeout(() => setCopiedWalletId(null), 2000);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(wallet)) { setFormError("Invalid Solana wallet address"); return; }
    setSubmitting(true);
    const res = await fetch("/api/contractors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: email || null, solana_wallet: wallet }),
    });
    if (res.ok) {
      toast("Contractor added", "success");
      setName(""); setEmail(""); setWallet(""); setShowForm(false);
      fetchContractors();
    } else {
      const data = await res.json();
      setFormError(data.error || "Failed to add contractor");
    }
    setSubmitting(false);
  }

  const filtered = contractors.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="animate-fade-in relative z-[1]">
      {/* Top bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search contractors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm input-base search-glow"
          />
        </div>

        <button
          onClick={openInviteModal}
          className="px-4 py-2 text-sm flex items-center gap-1.5 rounded-lg font-medium transition-colors"
          style={{ border: "1px solid var(--green)", color: "var(--green)", background: "transparent" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--green-dim)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </svg>
          Invite Contractor
        </button>

        <button
          onClick={() => { setShowForm(!showForm); if (!showForm) window.scrollTo({ top: 0, behavior: "smooth" }); }}
          className={`px-4 py-2 text-sm flex items-center gap-1.5 ${showForm ? "btn-secondary" : "btn-primary"}`}
        >
          {!showForm && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          )}
          {showForm ? "Cancel" : "Add Contractor"}
        </button>
      </div>

      {/* Add Form */}
      {showForm && (
        <div className="card p-6 mb-6 animate-fade-in">
          <h2 className="font-heading font-semibold text-sm mb-4">New Contractor</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] mb-1.5 font-medium">Name *</label>
                <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className="w-full px-3 py-2.5 text-sm input-base" />
              </div>
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] mb-1.5 font-medium">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" className="w-full px-3 py-2.5 text-sm input-base" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] mb-1.5 font-medium">Solana Wallet Address *</label>
              <input required value={wallet} onChange={(e) => setWallet(e.target.value)} placeholder="Enter base58 Solana address" className="w-full px-3 py-2.5 text-sm font-mono-data input-base" />
            </div>
            {formError && <p className="text-sm text-[var(--red)]">{formError}</p>}
            <button type="submit" disabled={submitting} className="px-6 py-2.5 text-sm btn-primary">
              {submitting ? "Adding..." : "Add Contractor"}
            </button>
          </form>
        </div>
      )}

      {/* Cards Grid */}
      {loading ? (
        <div className="py-20 text-center text-[var(--text-muted)]">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 stagger-children">
          {filtered.map((c) => {
            const initials = getInitials(c.name);
            const totalPaid = totalPaidMap[c.id] || 0;
            const lastPaid = lastPaidMap[c.id];
            return (
              <div key={c.id} className="card flex flex-col overflow-hidden">
                <div className="p-4 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}>
                    <span className="text-sm font-bold" style={{ color: "var(--bg-base)" }}>{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-[var(--text-primary)] text-sm truncate">{c.name}</h3>
                    <div className="flex items-center gap-1 mt-0.5">
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="2" y="4" width="20" height="16" rx="2" /><polyline points="2,4 12,13 22,4" />
                      </svg>
                      <span className="text-xs text-[var(--text-muted)] truncate">{c.email || "No email"}</span>
                    </div>
                  </div>
                  {/* 3-dot menu */}
                  <div className="relative flex-shrink-0" ref={openMenuId === c.id ? menuRef : undefined}>
                    <button
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === c.id ? null : c.id); }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                      </svg>
                    </button>
                    {openMenuId === c.id && (
                      <div className="dot-menu-dropdown">
                        <button className="dot-menu-item" onClick={() => { setOpenMenuId(null); }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                          Edit
                        </button>
                        <button
                          className="dot-menu-item"
                          onClick={() => {
                            setOpenMenuId(null);
                            setInviteCompanyName("");
                            setShowInviteModal(true);
                            setGeneratedInvite(null);
                            setCopied(false);
                          }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                          Copy invite link
                        </button>
                        <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                        <button className="dot-menu-item dot-menu-item-danger" onClick={() => setOpenMenuId(null)}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /></svg>
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Wallet row with copy */}
                <div className="wallet-row px-4 py-2.5 flex items-center justify-between border-t border-[var(--border)] group/wallet">
                  <div className="flex items-center gap-1.5 text-xs text-[var(--text-muted)]">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" />
                    </svg>
                    Wallet
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono-data text-xs text-[var(--text-secondary)]">{truncateWallet(c.solana_wallet)}</span>
                    <div className="relative">
                      <button
                        className="copy-wallet-btn p-1 rounded hover:bg-[var(--bg-hover)] transition-colors"
                        onClick={() => copyWallet(c.id, c.solana_wallet)}
                        title="Copy wallet address"
                      >
                        {copiedWalletId === c.id ? (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 12 10 16 18 8" /></svg>
                        ) : (
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
                        )}
                      </button>
                      {copiedWalletId === c.id && (
                        <span className="absolute -top-7 right-0 text-[10px] px-2 py-1 rounded whitespace-nowrap pointer-events-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-bright)', color: 'var(--green)' }}>
                          Copied!
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Total paid + last paid */}
                <div className="px-4 py-2.5 flex items-center justify-between border-t border-[var(--border)]">
                  <div>
                    <span className="text-xs text-[var(--text-muted)]">Total paid</span>
                    <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                      {lastPaid ? `Last: ${daysAgo(lastPaid)}` : "Never paid"}
                    </p>
                  </div>
                  <span className="font-mono-data text-sm font-semibold text-[var(--green)]">
                    ${totalPaid.toFixed(2)}
                  </span>
                </div>

                {/* Pay button */}
                <div className="p-3 border-t border-[var(--border)]">
                  <Link
                    href={`/pay/${c.id}`}
                    className="flex items-center justify-center gap-2 w-full py-2.5 text-sm rounded-lg font-medium transition-all"
                    style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid var(--green-border)" }}
                    onMouseEnter={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--green)";
                      el.style.color = "var(--bg-base)";
                      el.style.boxShadow = "0 4px 16px rgba(0,230,160,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      const el = e.currentTarget as HTMLElement;
                      el.style.background = "var(--green-dim)";
                      el.style.color = "var(--green)";
                      el.style.boxShadow = "none";
                    }}
                  >
                    ⚡ Pay
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Ghost card */}
          <button
            onClick={() => { setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            className="min-h-[210px] rounded-xl flex flex-col items-center justify-center gap-3 transition-all group"
            style={{ border: "1.5px dashed var(--border-bright)" }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--green)";
              el.style.background = "rgba(0,230,160,0.03)";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLElement;
              el.style.borderColor = "var(--border-bright)";
              el.style.background = "transparent";
            }}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center transition-colors"
              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}
            >
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                className="group-hover:stroke-[var(--green)] transition-all group-hover:rotate-90"
                style={{ transition: 'stroke 150ms, transform 200ms' }}
              >
                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <span className="text-xs text-[var(--text-muted)] group-hover:text-[var(--green)] transition-colors">
              Add Contractor
            </span>
          </button>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }} onClick={() => setShowInviteModal(false)}>
          <div className="card w-full max-w-lg flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-5 border-b border-[var(--border)] flex items-center justify-between flex-shrink-0">
              <div>
                <h2 className="font-heading font-semibold text-base text-[var(--text-primary)]">Invite a Contractor</h2>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Share a link — they fill in their own details</p>
              </div>
              <button onClick={() => setShowInviteModal(false)} className="p-1.5 rounded-md text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div className="px-6 py-5 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-[10px] text-[var(--text-muted)] uppercase tracking-[0.08em] mb-1.5 font-medium">
                  Your Company Name <span className="normal-case">(optional)</span>
                </label>
                <input type="text" value={inviteCompanyName} onChange={(e) => setInviteCompanyName(e.target.value)} placeholder="e.g. Acme Inc." className="w-full px-3 py-2.5 text-sm input-base" />
              </div>
              <button onClick={handleGenerateInvite} disabled={inviteGenerating} className="w-full py-3 text-sm btn-primary">
                {inviteGenerating ? "Generating..." : "Generate Invite Link"}
              </button>
              {generatedInvite?.invite_url && (
                <div className="animate-fade-in">
                  <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: "var(--bg-base)", border: "1px solid var(--green-border)" }}>
                    <span className="flex-1 text-xs font-mono-data text-[var(--green)] truncate">{generatedInvite.invite_url}</span>
                    <button
                      onClick={() => handleCopy(generatedInvite.invite_url!)}
                      className="flex-shrink-0 px-3 py-1.5 text-xs rounded-md font-medium transition-colors"
                      style={{ background: copied ? "var(--green)" : "var(--green-dim)", color: copied ? "var(--bg-base)" : "var(--green)" }}
                    >
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] mt-2 flex items-center gap-1">
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    Expires in 15 minutes · Can only be used once
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
