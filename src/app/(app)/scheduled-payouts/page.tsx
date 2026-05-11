"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/toast";

interface Contractor {
  id: string;
  name: string;
  email: string | null;
  solana_wallet: string;
}

interface ScheduledPayment {
  id: string;
  scheduled_payout_id: string;
  payout_id: string | null;
  due_date: string;
  paid_date: string | null;
  status: string;
}

interface ScheduledPayout {
  id: string;
  contractor_id: string;
  amount_usd: number;
  day_of_month: number;
  status: string;
  last_paid_date: string | null;
  next_due_date: string;
  created_at: string;
  contractors: Contractor;
  payments: ScheduledPayment[];
}

type FilterTab = "all" | "due" | "upcoming" | "paused";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function getOrdinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function truncateWallet(wallet: string) {
  if (!wallet || wallet.length < 8) return wallet;
  return wallet.slice(0, 4) + "..." + wallet.slice(-4);
}

function getStatusInfo(schedule: ScheduledPayout): { label: string; color: string; bg: string; border: string; isDue: boolean; isOverdue: boolean } {
  if (schedule.status === "paused") {
    return { label: "PAUSED", color: "var(--text-muted)", bg: "var(--bg-elevated)", border: "var(--border)", isDue: false, isOverdue: false };
  }

  const today = new Date().toISOString().split("T")[0];
  const due = schedule.next_due_date;

  if (due === today) {
    return { label: "DUE TODAY", color: "#FFAD33", bg: "rgba(255,173,51,0.15)", border: "rgba(255,173,51,0.3)", isDue: true, isOverdue: false };
  }
  if (due < today) {
    return { label: "OVERDUE", color: "#FF5C5C", bg: "rgba(255,92,92,0.15)", border: "rgba(255,92,92,0.3)", isDue: false, isOverdue: true };
  }

  const dueDate = new Date(due + "T00:00:00");
  const formatted = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
  return { label: `NEXT: ${formatted}`, color: "var(--text-muted)", bg: "var(--bg-elevated)", border: "var(--border)", isDue: false, isOverdue: false };
}

function isDueOrOverdue(schedule: ScheduledPayout) {
  if (schedule.status !== "active") return false;
  const today = new Date().toISOString().split("T")[0];
  return schedule.next_due_date <= today;
}

function getFilterCategory(schedule: ScheduledPayout): FilterTab {
  if (schedule.status === "paused") return "paused";
  if (isDueOrOverdue(schedule)) return "due";
  return "upcoming";
}

export default function ScheduledPayoutsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [schedules, setSchedules] = useState<ScheduledPayout[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState<FilterTab>("all");
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const [formContractorId, setFormContractorId] = useState("");
  const [formAmount, setFormAmount] = useState("");
  const [formDay, setFormDay] = useState("1");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onOutsideClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    }
    document.addEventListener("mousedown", onOutsideClick);
    return () => document.removeEventListener("mousedown", onOutsideClick);
  }, []);

  async function fetchData() {
    try {
      const [sRes, cRes] = await Promise.all([
        fetch("/api/scheduled-payouts"),
        fetch("/api/contractors"),
      ]);
      const [sData, cData] = await Promise.all([sRes.json(), cRes.json()]);
      setSchedules(Array.isArray(sData) ? sData : []);
      setContractors(Array.isArray(cData) ? cData : []);
    } catch {
      toast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    const amount = parseFloat(formAmount);
    if (!formContractorId) { toast("Select a contractor", "error"); return; }
    if (!amount || amount < 1 || amount > 10) { toast("Amount must be $1-$10", "error"); return; }

    setCreating(true);
    try {
      const res = await fetch("/api/scheduled-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractorId: formContractorId,
          amountUsd: amount,
          dayOfMonth: parseInt(formDay),
        }),
      });
      if (res.ok) {
        toast("Schedule created", "success");
        setShowForm(false);
        setFormContractorId("");
        setFormAmount("");
        setFormDay("1");
        fetchData();
      } else {
        const data = await res.json();
        toast(data.error || "Failed to create", "error");
      }
    } catch {
      toast("Network error", "error");
    } finally {
      setCreating(false);
    }
  }

  async function handleAction(id: string, action: "pause" | "resume" | "cancel") {
    try {
      const res = await fetch(`/api/scheduled-payouts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        toast(
          action === "cancel" ? "Schedule cancelled" : action === "pause" ? "Schedule paused" : "Schedule resumed",
          "success"
        );
        setOpenMenu(null);
        fetchData();
      } else {
        toast("Action failed", "error");
      }
    } catch {
      toast("Network error", "error");
    }
  }

  function handlePayNow(schedule: ScheduledPayout) {
    const pendingPayment = schedule.payments.find((p) => p.status === "pending");
    const params = new URLSearchParams({
      amount: String(schedule.amount_usd),
      scheduled_payout_id: schedule.id,
      ...(pendingPayment && { scheduled_payment_id: pendingPayment.id }),
    });
    router.push(`/pay/${schedule.contractor_id}?${params.toString()}`);
  }

  const activeSchedules = schedules.filter((s) => s.status === "active");
  const totalMonthly = activeSchedules.reduce((sum, s) => sum + Number(s.amount_usd), 0);
  const dueCount = activeSchedules.filter(isDueOrOverdue).length;
  const totalPaid = schedules.reduce((sum, s) => {
    const paid = s.payments.filter((p) => p.status === "paid");
    return sum + paid.reduce((ps) => ps + Number(s.amount_usd), 0);
  }, 0);

  const filtered = filter === "all"
    ? schedules
    : schedules.filter((s) => getFilterCategory(s) === filter);

  const currentMonth = new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
        <div className="w-5 h-5 border-2 border-[var(--border)] border-t-[var(--green)] rounded-full animate-spin mr-3" />
        Loading scheduled payouts...
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="flex gap-8 items-start">
        {/* ── LEFT COLUMN ── */}
        <div className="flex-[11_11_0%] min-w-0">

          {/* Hero Header */}
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-2 flex items-center gap-1.5" style={{ color: "var(--green)" }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} />
              Recurring Payouts
            </p>
            <div className="flex items-end justify-between">
              <div>
                <h1 className="font-heading text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                  Scheduled <span style={{ color: "var(--green)" }}>Payouts</span>
                </h1>
                <p className="text-sm max-w-md" style={{ color: "var(--text-muted)" }}>
                  Set it once, get reminded every month. Approve with a tap — USDC settles to your contractors on Solana within seconds.
                </p>
              </div>
              <button
                onClick={() => setShowForm(!showForm)}
                className="text-sm px-5 py-2.5 rounded-full font-semibold flex items-center gap-2 transition-all"
                style={{ background: "var(--green)", color: "#080C14", boxShadow: "0 0 20px rgba(0,230,160,0.3)" }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                New schedule
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </button>
            </div>
          </div>

          {/* New Schedule Form */}
          {showForm && (
            <div
              className="card p-5 mb-6 animate-fade-in"
              style={{ borderColor: "rgba(0,230,160,0.25)", borderLeftWidth: "3px", borderLeftColor: "var(--green)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-muted)" }}>
                New Scheduled Payout
              </p>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Contractor
                  </label>
                  <select
                    value={formContractorId}
                    onChange={(e) => setFormContractorId(e.target.value)}
                    className="input-base w-full text-sm py-2 px-3 rounded-lg"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    <option value="">Select...</option>
                    {contractors.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Amount (USD)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    step="0.01"
                    value={formAmount}
                    onChange={(e) => setFormAmount(e.target.value)}
                    placeholder="5.00"
                    className="input-base w-full text-sm py-2 px-3 rounded-lg [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
                    Day of Month
                  </label>
                  <select
                    value={formDay}
                    onChange={(e) => setFormDay(e.target.value)}
                    className="input-base w-full text-sm py-2 px-3 rounded-lg"
                    style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-primary)" }}
                  >
                    {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{getOrdinal(d)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="text-sm px-5 py-2 rounded-lg font-medium transition-all"
                  style={{ background: "var(--green)", color: "#080C14" }}
                >
                  {creating ? "Creating..." : "Create Schedule"}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="text-sm px-4 py-2 rounded-lg font-medium transition-colors"
                  style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Filter Tabs */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1 p-1 rounded-lg" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
              {([
                { key: "all", label: "All" },
                { key: "due", label: "Due", dot: true },
                { key: "upcoming", label: "Upcoming" },
                { key: "paused", label: "Paused" },
              ] as { key: FilterTab; label: string; dot?: boolean }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setFilter(tab.key)}
                  className="text-xs font-medium px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5"
                  style={{
                    background: filter === tab.key ? "var(--bg-elevated)" : "transparent",
                    color: filter === tab.key ? "var(--text-primary)" : "var(--text-muted)",
                    border: filter === tab.key ? "1px solid var(--border)" : "1px solid transparent",
                  }}
                >
                  {tab.dot && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#FFAD33" }} />}
                  {tab.label}
                </button>
              ))}
            </div>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Showing {filtered.length} schedule{filtered.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Schedule Cards */}
          {filtered.length === 0 ? (
            <div className="card p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--text-muted)" }}>
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
                {filter === "all" ? "No scheduled payouts yet" : `No ${filter} schedules`}
              </p>
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {filter === "all"
                  ? "Create a schedule to get reminded when it's time to pay your contractors."
                  : "Try a different filter to see your schedules."}
              </p>
            </div>
          ) : (
            <div className="space-y-3" ref={menuRef}>
              {filtered.map((schedule) => {
                const c = schedule.contractors;
                const statusInfo = getStatusInfo(schedule);
                const showPayNow = isDueOrOverdue(schedule);
                const paidCount = schedule.payments.filter((p) => p.status === "paid").length;
                const walletShort = c ? truncateWallet(c.solana_wallet) : "";
                const amountWhole = Math.floor(Number(schedule.amount_usd));
                const amountCents = (Number(schedule.amount_usd) % 1).toFixed(2).slice(1);

                return (
                  <div
                    key={schedule.id}
                    className="card p-5 transition-all duration-200"
                    style={{
                      borderColor: (statusInfo.isDue || statusInfo.isOverdue) ? statusInfo.border : undefined,
                      boxShadow: statusInfo.isDue
                        ? "0 0 24px rgba(255,173,51,0.08), inset 0 0 0 1px rgba(255,173,51,0.1)"
                        : statusInfo.isOverdue
                          ? "0 0 24px rgba(255,92,92,0.08)"
                          : undefined,
                    }}
                  >
                    <div className="flex items-center gap-4">
                      {/* Avatar with status ring */}
                      <div className="relative flex-shrink-0">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center"
                          style={{ background: "linear-gradient(135deg, var(--green-light), var(--green))" }}
                        >
                          <span className="text-sm font-bold" style={{ color: "var(--bg-base)" }}>
                            {c ? getInitials(c.name) : "?"}
                          </span>
                        </div>
                        {schedule.status === "active" && (
                          <span
                            className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2"
                            style={{
                              background: statusInfo.isDue ? "#FFAD33" : statusInfo.isOverdue ? "#FF5C5C" : "var(--green)",
                              borderColor: "var(--bg-surface)",
                            }}
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2.5 mb-1">
                          <p className="font-semibold text-sm text-[var(--text-primary)] truncate">
                            {c?.name || "Unknown"}
                          </p>
                          <span
                            className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full ${statusInfo.isDue ? "animate-pulse" : ""}`}
                            style={{ background: statusInfo.bg, color: statusInfo.color, border: `1px solid ${statusInfo.border}` }}
                          >
                            {statusInfo.isDue && <span className="inline-block w-1 h-1 rounded-full mr-1" style={{ background: "#FFAD33", verticalAlign: "middle" }} />}
                            {statusInfo.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-muted)" }}>
                          {walletShort && (
                            <>
                              <span className="font-mono-data" style={{ color: "var(--green)" }}>{walletShort}</span>
                              <span style={{ opacity: 0.3 }}>·</span>
                            </>
                          )}
                          <span>Every {getOrdinal(schedule.day_of_month)}</span>
                          <span style={{ opacity: 0.3 }}>·</span>
                          <span>{paidCount} payment{paidCount !== 1 ? "s" : ""} made</span>
                        </div>
                      </div>

                      {/* Amount */}
                      <div className="text-right flex-shrink-0 mr-2">
                        <p className="font-mono-data font-bold leading-none" style={{ color: "var(--text-primary)" }}>
                          <span style={{ fontSize: "22px" }}>${amountWhole.toLocaleString()}</span>
                          <span className="text-sm" style={{ color: "var(--text-muted)" }}>{amountCents}</span>
                        </p>
                        <p className="text-[9px] uppercase tracking-wider mt-0.5 font-medium" style={{ color: "var(--text-muted)" }}>USDC / month</p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {showPayNow && (
                          <button
                            onClick={() => handlePayNow(schedule)}
                            className="text-xs font-semibold px-4 py-2 rounded-lg transition-all flex items-center gap-1.5"
                            style={{
                              background: "var(--green)",
                              color: "#080C14",
                              boxShadow: "0 0 16px rgba(0,230,160,0.3)",
                            }}
                          >
                            Pay now
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                            </svg>
                          </button>
                        )}

                        {schedule.status === "active" && (
                          <button
                            onClick={() => handleAction(schedule.id, "pause")}
                            className="text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" /></svg>
                            Pause
                          </button>
                        )}

                        {schedule.status === "paused" && (
                          <button
                            onClick={() => handleAction(schedule.id, "resume")}
                            className="text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                            style={{ background: "var(--green-dim)", color: "var(--green)", border: "1px solid rgba(0,230,160,0.2)" }}
                          >
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                            Resume
                          </button>
                        )}

                        {schedule.status !== "paused" && !showPayNow && (
                          <button
                            onClick={() => handleAction(schedule.id, "cancel")}
                            className="text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            Cancel
                          </button>
                        )}

                        {schedule.status === "paused" && (
                          <button
                            onClick={() => handleAction(schedule.id, "cancel")}
                            className="text-xs px-3 py-2 rounded-lg transition-colors flex items-center gap-1.5"
                            style={{ background: "var(--bg-elevated)", color: "var(--text-muted)", border: "1px solid var(--border)" }}
                          >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                            Cancel
                          </button>
                        )}

                        {/* Three-dot menu */}
                        <div className="relative">
                          <button
                            onClick={() => setOpenMenu(openMenu === schedule.id ? null : schedule.id)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
                            style={{ background: openMenu === schedule.id ? "var(--bg-elevated)" : "transparent", color: "var(--text-muted)" }}
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                              <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
                            </svg>
                          </button>
                          {openMenu === schedule.id && (
                            <div
                              className="absolute right-0 top-full mt-1 w-40 rounded-xl overflow-hidden z-50 animate-fade-in"
                              style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", boxShadow: "0 8px 24px rgba(0,0,0,0.2)" }}
                            >
                              <button
                                onClick={() => { handlePayNow(schedule); setOpenMenu(null); }}
                                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-hover)]"
                                style={{ color: "var(--text-primary)" }}
                              >
                                Pay now
                              </button>
                              {schedule.status === "active" ? (
                                <button
                                  onClick={() => { handleAction(schedule.id, "pause"); }}
                                  className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-hover)]"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  Pause schedule
                                </button>
                              ) : schedule.status === "paused" ? (
                                <button
                                  onClick={() => { handleAction(schedule.id, "resume"); }}
                                  className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[var(--bg-hover)]"
                                  style={{ color: "var(--text-primary)" }}
                                >
                                  Resume schedule
                                </button>
                              ) : null}
                              <div className="h-px mx-2" style={{ background: "var(--border)" }} />
                              <button
                                onClick={() => { handleAction(schedule.id, "cancel"); }}
                                className="w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[rgba(255,92,92,0.08)]"
                                style={{ color: "#FF5C5C" }}
                              >
                                Cancel schedule
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT COLUMN — Summary ── */}
        <div className="flex-[5_5_0%] min-w-[260px] self-start sticky top-20 space-y-4">
          {/* Schedule Summary */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                Schedule Summary
              </p>
              <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>{currentMonth}</p>
            </div>
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Monthly Total</p>
              <p className="font-mono-data font-bold leading-none" style={{ color: "var(--green)" }}>
                <span style={{ fontSize: "32px" }}>${Math.floor(totalMonthly).toLocaleString()}</span>
                <span className="text-base" style={{ color: "var(--text-muted)" }}>.{(totalMonthly % 1).toFixed(2).slice(2)}</span>
                <span className="text-sm font-normal ml-1.5" style={{ color: "var(--text-muted)" }}>USDC</span>
              </p>
            </div>

            {/* Progress bar */}
            {totalMonthly > 0 && (
              <div className="mb-4">
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--bg-elevated)" }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.min(100, (totalPaid / Math.max(totalMonthly, 1)) * 100)}%`,
                      background: "linear-gradient(90deg, var(--green), var(--green-light))",
                    }}
                  />
                </div>
                <div className="flex justify-between mt-1.5">
                  <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>${totalPaid.toFixed(0)} spent</p>
                </div>
              </div>
            )}

            <div className="h-px mb-4" style={{ background: "var(--border)" }} />
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg p-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
                <p className="text-[9px] uppercase tracking-wider mb-0.5 font-medium" style={{ color: "var(--text-muted)" }}>Active</p>
                <p className="font-mono-data text-xl font-bold" style={{ color: "var(--green)" }}>{activeSchedules.length}</p>
              </div>
              <div className="rounded-lg p-3" style={{ background: dueCount > 0 ? "rgba(255,173,51,0.06)" : "var(--bg-elevated)", border: `1px solid ${dueCount > 0 ? "rgba(255,173,51,0.2)" : "var(--border)"}` }}>
                <p className="text-[9px] uppercase tracking-wider mb-0.5 font-medium" style={{ color: dueCount > 0 ? "#FFAD33" : "var(--text-muted)" }}>
                  Due / Overdue
                </p>
                <p className="font-mono-data text-xl font-bold" style={{ color: dueCount > 0 ? "#FFAD33" : "var(--text-primary)" }}>
                  {dueCount}
                </p>
              </div>
            </div>
          </div>

          {/* How it works */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.1em]" style={{ color: "var(--text-muted)" }}>
                How it works
              </p>
              <p className="text-[10px]" style={{ color: "var(--green)" }}>~30s setup</p>
            </div>
            <div className="space-y-0">
              {[
                "Set a monthly schedule",
                "Get reminded when due",
                "Approve & pay via card",
                "USDC sent automatically",
              ].map((step, i, arr) => (
                <div key={i} className="flex gap-3 items-center">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center"
                      style={{
                        background: i === 0 ? "rgba(0,230,160,0.12)" : "transparent",
                        border: `1.5px solid ${i === 0 ? "var(--green)" : "var(--border)"}`,
                      }}
                    >
                      {i === 0 ? (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--border)" }} />
                      )}
                    </div>
                    {i < arr.length - 1 && (
                      <div className="w-px" style={{ height: "20px", background: "var(--border)" }} />
                    )}
                  </div>
                  <div className="flex items-center justify-between flex-1 pb-3 pt-0.5">
                    <p className="text-xs" style={{ color: i === 0 ? "var(--text-primary)" : "var(--text-muted)" }}>{step}</p>
                    <p className="text-[10px] font-mono-data" style={{ color: "var(--border-bright)", opacity: 0.5 }}>
                      {String(i + 1).padStart(2, "0")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pro Tip */}
          <div
            className="rounded-xl p-4"
            style={{
              background: "linear-gradient(135deg, rgba(0,230,160,0.08) 0%, rgba(0,230,160,0.03) 100%)",
              border: "1px solid rgba(0,230,160,0.15)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "var(--green)" }}>Pro Tip</p>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Schedule all your contractor payouts for the 1st of the month — review and approve them all in one session.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
