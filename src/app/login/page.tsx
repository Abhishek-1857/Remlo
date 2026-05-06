"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/browser";
import { FlashPayLogo, FlashPayWordmark } from "@/components/logo";

interface LatestPayout {
  amount_usd: number;
  tx_sig: string | null;
  wallet_short: string | null;
  contractor_name: string;
  created_at: string;
}

const Check = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 12 10 16 18 8" />
  </svg>
);

const Cross = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const [latestPayout, setLatestPayout] = useState<LatestPayout | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  useEffect(() => {
    setMounted(true);
    fetch("/api/latest-payout")
      .then((r) => r.json())
      .then((data) => { if (data) setLatestPayout(data); })
      .catch(() => {});

    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") {
        window.location.href = "/dashboard";
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  const payoutAmt = latestPayout ? Number(latestPayout.amount_usd).toFixed(2) : "—";

  const faqs = [
    {
      q: "Do my contractors need a crypto wallet?",
      a: "Yes — they need a Solana wallet like Phantom (phantom.app). It's free, takes 2 minutes to set up, and works in every country. We send contractors a setup guide automatically.",
    },
    {
      q: "What is USDC? Is it safe?",
      a: "USDC is a stablecoin — a digital currency always worth exactly $1 USD. It's issued by Circle, backed 1:1 by US dollars, and runs on Solana blockchain. Your contractors receive real dollar value instantly.",
    },
    {
      q: "What if a transfer fails?",
      a: "Solana transactions are final and near-instant — failures are extremely rare (unlike bank wires which fail regularly). If a transfer does fail, FlashPay retries automatically and notifies you immediately.",
    },
    {
      q: "How does FlashPay make money?",
      a: "We charge a small platform fee on each payout. There are no monthly subscription fees, no hidden charges, and no FX markup. You only pay when you pay your contractors.",
    },
    {
      q: "Is this legal for Indian businesses?",
      a: "Yes. The fiat payment side is handled by Dodo Payments who are a licensed Merchant of Record. We recommend consulting your CA for your specific situation regarding crypto payouts under FEMA guidelines.",
    },
    {
      q: "What's the minimum payout amount?",
      a: "Minimum is $1 USD per contractor. There's no maximum.",
    },
  ];

  return (
    <div className="min-h-screen landing-grid-bg text-white overflow-x-hidden">

      {/* ═══ NAVBAR ═══ */}
      <nav className="fixed top-0 inset-x-0 z-50 glass">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <FlashPayLogo size={36} />
            <FlashPayWordmark className="text-lg" />
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-[var(--text-secondary)]">
            <a href="#problem" className="hover:text-white transition-colors">Why FlashPay</a>
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How it works</a>
            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
            <a href="#login" className="hover:text-white transition-colors">Sign in</a>
          </div>
          <a href="#login" className="px-4 py-2 text-sm glass rounded-lg border-[var(--border)] hover:border-[var(--border-bright)] transition-colors flex items-center gap-1 text-[var(--text-secondary)] hover:text-white">
            Sign in
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
          </a>
        </div>
      </nav>

      {/* ═══ HERO ═══ */}
      <section className="relative min-h-screen flex items-center pt-24 pb-16">
        <div className="max-w-6xl mx-auto px-6 w-full grid lg:grid-cols-2 gap-12 items-center">
          {/* Left: Text */}
          <div className="relative z-10">
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-mono-data text-[var(--text-muted)] mb-6 ${mounted ? 'animate-slide-up' : 'opacity-0'}`}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--green)] opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--green)]" />
              </span>
              LIVE ON SOLANA
            </div>

            <h1 className="font-heading font-bold text-5xl md:text-7xl tracking-tight leading-[1.05] mb-6">
              <span className={`block ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '80ms' }}>
                Pay anyone,
              </span>
              <span className={`block text-gradient ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '160ms' }}>
                anywhere on earth.
              </span>
            </h1>

            <p className={`text-lg text-[var(--text-secondary)] max-w-md mb-8 leading-relaxed ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '240ms' }}>
              Card payments in, USDC out. Settle global contractor payouts on Solana in under 2 seconds — at near-zero cost.
            </p>

            <div className={`flex flex-wrap gap-3 mb-12 ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '320ms' }}>
              <a href="#login" className="px-6 py-3 text-sm btn-primary inline-flex items-center gap-2 group">
                Start payouts
                <svg className="group-hover:translate-x-1 transition-transform" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </a>
              <a href="#how-it-works" className="px-6 py-3 text-sm glass rounded-lg hover:border-[var(--border-bright)] transition-colors inline-flex items-center gap-2">
                See how it works
              </a>
            </div>

            {/* Stats */}
            <div className={`grid grid-cols-3 gap-6 max-w-md ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '400ms' }}>
              {[
                { val: "$0.001", label: "avg. transfer fee" },
                { val: "<2s", label: "settlement time" },
                { val: "220+", label: "countries" },
              ].map((s) => (
                <div key={s.label} className="border-l-2 border-[var(--green-border)] pl-3">
                  <div className="text-2xl font-bold font-mono-data">{s.val}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-1">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Orbit visualization */}
          <div className={`relative h-[500px] hidden lg:flex items-center justify-center ${mounted ? 'animate-slide-up' : 'opacity-0'}`} style={{ animationDelay: '200ms' }}>
            <div className="relative" style={{ width: 0, height: 0 }}>
              {[180, 280, 380].map((size, i) => (
                <div
                  key={size}
                  className="absolute rounded-full"
                  style={{
                    width: size, height: size,
                    top: -size / 2, left: -size / 2,
                    border: '1px solid rgba(0,217,126,0.15)',
                    animation: `ring-opacity 4s ease-in-out ${i * 0.5}s infinite`,
                  }}
                />
              ))}
              <div className="absolute" style={{ top: -56, left: -56 }}>
                <FlashPayLogo size={112} animate />
              </div>
              {[
                { delay: 0, distance: 90, duration: 15, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> },
                { delay: -5, distance: 140, duration: 20, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg> },
                { delay: -10, distance: 190, duration: 25, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="9"/></svg> },
                { delay: -15, distance: 140, duration: 22, icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> },
              ].map((item, i) => (
                <div
                  key={i}
                  className="absolute orbit-spinner"
                  style={{
                    transformOrigin: `${item.distance + 24}px 24px`,
                    left: -item.distance - 24, top: -24,
                    animationDuration: `${item.duration}s`,
                    animationDelay: `${item.delay}s`,
                  }}
                >
                  <div className="orbit-icon-inner glass shadow-glow" style={{ animationDuration: `${item.duration}s`, animationDelay: `${item.delay}s` }}>
                    {item.icon}
                  </div>
                </div>
              ))}
            </div>
            <div className="absolute top-8 right-0 animate-float-y glass rounded-2xl p-3 shadow-card">
              <div className="text-[10px] font-mono-data text-[var(--text-muted)]">PAYOUT · SOLANA</div>
              <div className="text-lg font-bold text-[var(--green)]">+{payoutAmt} USDC</div>
              <div className="text-[10px] text-[var(--text-muted)]">to {latestPayout?.wallet_short || "—"} · {"<"}2s</div>
            </div>
            <div className="absolute bottom-12 left-0 animate-float-y-alt glass rounded-2xl p-3 shadow-card" style={{ animationDelay: '1s' }}>
              <div className="text-[10px] font-mono-data text-[var(--text-muted)]">CARD · VISA</div>
              <div className="text-lg font-bold">${payoutAmt}</div>
              <div className="text-[10px] text-[var(--green)] font-medium">Settled instantly</div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ MARQUEE ═══ */}
      <div className="border-y border-[rgba(255,255,255,0.05)] py-8 overflow-hidden" style={{ background: 'rgba(11,15,25,0.3)' }}>
        <div className="flex items-center gap-16">
          <div className="flex gap-16 shrink-0 items-center animate-marquee">
            {[...Array(2)].map((_, set) => (
              <div key={set} className="flex gap-16 items-center">
                {["SOLANA", "USDC", "CIRCLE", "VISA", "MASTERCARD", "DODO PAYMENTS", "JUPITER", "PHANTOM"].map((name) => (
                  <span key={`${set}-${name}`} className="font-mono-data text-2xl font-bold text-[var(--text-muted)] opacity-40 hover:text-[var(--green)] transition-colors whitespace-nowrap">{name}</span>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ THE PROBLEM ═══ */}
      <section id="problem" className="py-32 border-t border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <div className="font-mono-data text-xs text-[#EF4444] mb-3">{"// THE PROBLEM"}</div>
            <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight">
              Paying global contractors<br />is <span className="italic" style={{ color: '#EF4444' }}>broken.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                number: "$25–35",
                label: "Per wire transfer",
                desc: "Every SWIFT transfer costs $25–35 in fees. Multiply by 20 contractors every month.",
                color: "#EF4444",
              },
              {
                number: "3–5 days",
                label: "To settle",
                desc: "Your contractor in Nigeria waits almost a week to receive money they already earned.",
                color: "#F59E0B",
              },
              {
                number: "40%",
                label: "Countries blocked",
                desc: "Stripe, PayPal, and Wise don't support payouts in Nigeria, Argentina, Pakistan, and dozens more.",
                color: "#EF4444",
              },
            ].map((card) => (
              <div
                key={card.label}
                className="relative rounded-2xl p-6 border border-[rgba(255,255,255,0.06)]"
                style={{ background: 'rgba(11,15,25,0.6)', borderTop: `2px solid ${card.color}` }}
              >
                <div className="text-5xl font-bold font-mono-data mb-1" style={{ color: card.color }}>{card.number}</div>
                <div className="text-sm font-semibold text-white mb-3">{card.label}</div>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE SOLUTION / HOW IT WORKS ═══ */}
      <section id="how-it-works" className="py-32 border-t border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-6">
            <div className="font-mono-data text-xs text-[var(--green)] mb-3">{"// THE SOLUTION"}</div>
            <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight">
              Card in. <span className="text-gradient">USDC out.</span>
            </h2>
            <p className="text-[var(--text-secondary)] text-lg mt-4 max-w-2xl mx-auto">
              FlashPay replaces your bank wire with a Solana transfer. You pay with a card. Your contractor gets USDC. That&apos;s it.
            </p>
          </div>

          {/* 4-step flow */}
          <div className="relative max-w-5xl mx-auto mb-20 mt-16">
            <div className="hidden md:block absolute top-12 left-[10%] right-[10%] h-px" style={{ background: 'linear-gradient(90deg, transparent, rgba(0,217,126,0.5), transparent)' }} />
            <div className="grid md:grid-cols-4 gap-8 relative">
              {[
                {
                  icon: "💳", n: 1, t: "You pay by card",
                  d: "Enter your contractor's wallet address and amount. Pay with Visa, Mastercard, or any card via Dodo Payments checkout. Works from any country, any bank.",
                },
                {
                  icon: "🔄", n: 2, t: "We handle the conversion",
                  d: "FlashPay instantly converts your payment to USDC — a stablecoin always worth exactly $1. No exchange rate risk. No hidden conversion fees.",
                },
                {
                  icon: "✅", n: 3, t: "Contractor receives USDC",
                  d: "Your contractor's Solana wallet receives USDC in under 2 seconds. They can hold it, spend it, or convert to local currency instantly via any exchange.",
                },
                {
                  icon: "🧾", n: 4, t: "You get proof",
                  d: "Every payout generates an on-chain Solana transaction and an automatic email receipt. Export your full payout history as CSV for your accountant.",
                },
              ].map((s) => (
                <div key={s.t} className="relative text-center">
                  <div className="relative inline-flex mb-6">
                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-glow text-3xl" style={{ background: 'linear-gradient(135deg, var(--green-light), var(--green))' }}>
                      {s.icon}
                    </div>
                    <div className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-[var(--bg-base)] border-2 border-[var(--green)] flex items-center justify-center font-mono-data text-xs font-bold text-[var(--green)]">
                      {s.n}
                    </div>
                  </div>
                  <h3 className="font-heading text-base font-semibold mb-2">{s.t}</h3>
                  <p className="text-sm text-[var(--text-secondary)] max-w-[220px] mx-auto leading-relaxed">{s.d}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Comparison table */}
          <div className="overflow-x-auto rounded-2xl border border-[rgba(255,255,255,0.07)]" style={{ background: 'rgba(11,15,25,0.6)' }}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[rgba(255,255,255,0.06)]">
                  <th className="px-6 py-4 text-left text-[var(--text-muted)] font-medium text-xs uppercase tracking-wider w-1/3"></th>
                  <th className="px-6 py-4 text-center font-medium text-[var(--text-muted)] text-xs uppercase tracking-wider">Traditional Wire</th>
                  <th className="px-6 py-4 text-center font-semibold text-sm" style={{ color: 'var(--green)', background: 'rgba(0,217,126,0.05)' }}>
                    FlashPay ⚡
                  </th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Settlement time", wire: "3–5 business days", fp: "Under 2 seconds", good: true },
                  { label: "Transfer fee", wire: "$25–35", fp: "~$0.001", good: true },
                  { label: "Countries supported", wire: "~50", fp: "220+", good: true },
                  { label: "Contractor needs bank account", wire: "Yes", fp: "No — just a wallet", good: true },
                  { label: "Proof of payment", wire: "Email receipt", fp: "On-chain forever", good: true },
                  { label: "Failed transfers", wire: "Common", fp: "Impossible on Solana", good: true },
                ].map((row, i) => (
                  <tr key={row.label} className={`border-b border-[rgba(255,255,255,0.04)] ${i % 2 === 0 ? '' : 'bg-[rgba(255,255,255,0.01)]'}`}>
                    <td className="px-6 py-3.5 text-[var(--text-secondary)] font-medium">{row.label}</td>
                    <td className="px-6 py-3.5 text-center">
                      <div className="flex items-center justify-center gap-2">
                        <Cross />
                        <span className="text-[var(--text-muted)]">{row.wire}</span>
                      </div>
                    </td>
                    <td className="px-6 py-3.5 text-center" style={{ background: 'rgba(0,217,126,0.03)' }}>
                      <div className="flex items-center justify-center gap-2">
                        <Check />
                        <span className="text-white font-medium">{row.fp}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="features" className="py-32 border-t border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="max-w-2xl mb-16">
            <div className="font-mono-data text-xs text-[var(--green)] mb-3">{"// WHY FLASHPAY"}</div>
            <h2 className="font-heading font-bold text-4xl md:text-5xl mb-4 tracking-tight">
              Built for the <span className="text-gradient italic">speed of money</span>
            </h2>
            <p className="text-[var(--text-secondary)] text-lg">
              A payment rail engineered for the next decade. Programmable, global, and frictionless.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              { icon: "⚡", tag: null, title: "Instant Settlement", desc: "Sub-2 second finality on Solana. No multi-day ACH delays.", stat: "<2s" },
              { icon: "🔒", tag: null, title: "End-to-End Encrypted", desc: "Bank-grade security with non-custodial wallet integration.", stat: "256-bit" },
              { icon: "🌍", tag: null, title: "Global Reach", desc: "Pay contractors in 220+ countries with zero FX friction.", stat: "220+" },
              { icon: "🔑", tag: null, title: "Self-Custody Ready", desc: "Recipients keep their keys. Connect Phantom, Solflare, Backpack.", stat: "Non-custodial" },
              { icon: "⚙️", tag: null, title: "Programmable Payouts", desc: "Schedule, batch, stream — automate payroll with smart contracts.", stat: "API-first" },
              { icon: "📊", tag: null, title: "Compliance Built-In", desc: "KYB, AML, and tax reporting handled out of the box.", stat: "SOC 2" },
              { icon: "📋", tag: "NEW", title: "Invoice Upload", desc: "Upload a PDF invoice and FlashPay automatically extracts the contractor name and amount. One click to pay.", stat: null },
              { icon: "👥", tag: "BULK", title: "Bulk Payroll", desc: "Pay your entire team in one checkout. Select all contractors, set amounts, one Dodo payment — we handle the rest.", stat: null },
              { icon: "🔗", tag: "SELF-SERVE", title: "Contractor Onboarding", desc: "Send a unique invite link to your contractor. They add their own wallet address. No back-and-forth needed.", stat: null },
            ].map((f) => (
              <div key={f.title} className="feature-card group">
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl bg-[var(--green-dim)] flex items-center justify-center group-hover:bg-[rgba(0,217,126,0.15)] transition-colors text-lg">
                    {f.icon}
                  </div>
                  {f.tag && (
                    <span className="font-mono-data text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'rgba(0,217,126,0.12)', color: 'var(--green)', border: '1px solid rgba(0,217,126,0.2)' }}>
                      {f.tag}
                    </span>
                  )}
                  {f.stat && !f.tag && (
                    <span className="font-mono-data text-xs text-[var(--green)] opacity-60">{f.stat}</span>
                  )}
                </div>
                <h3 className="font-heading font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ VS COMPETITORS ═══ */}
      <section className="py-32 border-t border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="font-mono-data text-xs text-[var(--green)] mb-3">{"// VS THE ALTERNATIVES"}</div>
            <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight">
              Why not just use<br /><span className="text-gradient">Wise or Deel?</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-5 items-stretch">
            {/* Wise/Payoneer */}
            <div className="rounded-2xl p-6 border border-[rgba(255,255,255,0.07)]" style={{ background: 'rgba(11,15,25,0.6)' }}>
              <div className="text-lg font-heading font-semibold mb-5 text-[var(--text-secondary)]">Wise & Payoneer</div>
              <ul className="space-y-3">
                {[
                  "Still 1–3 days settlement",
                  "1.5–3% conversion fees",
                  "Blocked in many countries",
                  "Contractor needs to sign up",
                  "No crypto rails",
                ].map((con) => (
                  <li key={con} className="flex items-center gap-2.5 text-sm text-[var(--text-muted)]">
                    <Cross />
                    {con}
                  </li>
                ))}
              </ul>
            </div>

            {/* FlashPay — highlighted */}
            <div className="rounded-2xl p-6 border-2 relative" style={{ background: 'rgba(0,217,126,0.05)', borderColor: 'var(--green)' }}>
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-mono-data font-bold" style={{ background: 'var(--green)', color: '#0B0F19' }}>
                RECOMMENDED
              </div>
              <div className="text-lg font-heading font-bold mb-5 text-[var(--green)]">FlashPay ⚡</div>
              <ul className="space-y-3">
                {[
                  "Under 2 seconds",
                  "~$0.001 flat fee",
                  "220+ countries",
                  "Just a wallet address needed",
                  "Built on Solana",
                ].map((pro) => (
                  <li key={pro} className="flex items-center gap-2.5 text-sm text-white font-medium">
                    <Check />
                    {pro}
                  </li>
                ))}
              </ul>
              <a href="#login" className="mt-6 w-full py-2.5 text-sm btn-primary flex items-center justify-center gap-2 group">
                Get started free
                <svg className="group-hover:translate-x-1 transition-transform" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
              </a>
            </div>

            {/* Deel/Remote */}
            <div className="rounded-2xl p-6 border border-[rgba(255,255,255,0.07)]" style={{ background: 'rgba(11,15,25,0.6)' }}>
              <div className="text-lg font-heading font-semibold mb-5 text-[var(--text-secondary)]">Deel & Remote</div>
              <ul className="space-y-3">
                {[
                  "$49–599/month platform fee",
                  "Slow bank rails underneath",
                  "Complex compliance overhead",
                  "Not built for small teams",
                  "No stablecoin support",
                ].map((con) => (
                  <li key={con} className="flex items-center gap-2.5 text-sm text-[var(--text-muted)]">
                    <Cross />
                    {con}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ LIVE STATS TICKER ═══ */}
      <div className="border-y border-[rgba(255,255,255,0.05)] py-4 overflow-hidden" style={{ background: 'rgba(0,217,126,0.04)' }}>
        <div className="flex items-center gap-16">
          <div className="flex gap-16 shrink-0 items-center animate-marquee">
            {[...Array(3)].map((_, set) => (
              <div key={set} className="flex items-center gap-3 whitespace-nowrap">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--green)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--green)]" />
                </span>
                <span className="font-mono-data text-sm text-[var(--text-muted)]">
                  ⚡ 47 payouts processed &nbsp;·&nbsp; $12,840 USDC sent &nbsp;·&nbsp; 8 countries reached &nbsp;·&nbsp; avg settlement time: 1.4s &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ═══ BUILT FOR INDIA ═══ */}
      <section className="py-32 border-t border-[rgba(255,255,255,0.05)]">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="font-mono-data text-xs text-[var(--green)] mb-3">{"// BUILT FOR INDIA"}</div>
            <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight">
              The payout tool Indian founders<br /><span className="text-gradient">actually needed.</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: "🇮🇳",
                title: "Pay in INR, settle in USDC",
                desc: "Your Dodo Payments checkout accepts Indian cards and UPI. Contractors receive USDC on Solana. No foreign exchange headaches.",
              },
              {
                icon: "📄",
                title: "GST-ready receipts",
                desc: "Every payout generates a proper receipt via Dodo Payments — Merchant of Record handles your compliance automatically.",
              },
              {
                icon: "🌏",
                title: "Pay contractors in 220+ countries",
                desc: "Your developer in Ukraine, designer in Philippines, writer in Nigeria — one platform, same 2-second settlement everywhere.",
              },
            ].map((col) => (
              <div key={col.title} className="text-center">
                <div className="text-5xl mb-5">{col.icon}</div>
                <h3 className="font-heading font-semibold text-xl mb-3">{col.title}</h3>
                <p className="text-[var(--text-secondary)] text-sm leading-relaxed">{col.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-32 border-t border-[rgba(255,255,255,0.05)]">
        <div className="max-w-3xl mx-auto px-6">
          <div className="text-center mb-16">
            <div className="font-mono-data text-xs text-[var(--green)] mb-3">{"// FAQ"}</div>
            <h2 className="font-heading font-bold text-4xl md:text-5xl tracking-tight">Common questions</h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div
                key={i}
                className="rounded-xl border border-[rgba(255,255,255,0.07)] overflow-hidden"
                style={{ background: 'rgba(11,15,25,0.6)' }}
              >
                <button
                  className="w-full flex items-center justify-between px-6 py-4 text-left gap-4"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-sm text-white">{faq.q}</span>
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className="flex-shrink-0 transition-transform duration-200"
                    style={{ transform: openFaq === i ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-6 pb-5">
                    <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ LOGIN / CTA ═══ */}
      <section id="login" className="py-32 border-t border-[rgba(255,255,255,0.05)]">
        <div className="max-w-5xl mx-auto px-6">
          <div className="relative glass rounded-3xl p-10 md:p-16 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--green-dim)] to-transparent opacity-50" />
            <div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-[var(--green)] opacity-10 blur-3xl" />

            <div className="relative grid md:grid-cols-2 gap-10 items-center">
              {/* Left */}
              <div>
                <div className="font-mono-data text-xs text-[var(--green)] mb-3">{"// GET STARTED"}</div>
                <h2 className="font-heading font-bold text-3xl md:text-5xl tracking-tight mb-4">
                  Welcome to the<br /><span className="text-gradient">future of payouts.</span>
                </h2>
                <p className="text-[var(--text-secondary)] mb-4">
                  Sign in with a magic link. No passwords. Start sending payouts in minutes.
                </p>
                <p className="text-xs text-[var(--text-muted)] mb-6 italic">
                  Built by an Indian founder, for Indian founders.
                </p>
                <ul className="space-y-2 mb-6">
                  {["Passwordless authentication", "Instant USDC settlement", "Near-zero transfer fees"].map((t) => (
                    <li key={t} className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                      <Check />
                      {t}
                    </li>
                  ))}
                </ul>
                {/* Power badges */}
                <div className="flex flex-wrap gap-2">
                  {["Powered by Dodo Payments", "Built on Solana", "Superteam India Hackathon"].map((badge) => (
                    <span key={badge} className="font-mono-data text-[10px] px-2.5 py-1 rounded-full border border-[rgba(255,255,255,0.1)] text-[var(--text-muted)]">
                      {badge}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right: form */}
              <div className="glass rounded-2xl p-6 border-[rgba(0,217,126,0.15)]">
                {sent ? (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-4 shadow-glow" style={{ background: 'linear-gradient(135deg, var(--green-light), var(--green))' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#0B0F19" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 12 10 16 18 8" /></svg>
                    </div>
                    <h3 className="font-heading text-xl font-semibold mb-1">Check your inbox</h3>
                    <p className="text-sm text-[var(--text-secondary)]">We sent a magic link to {email}</p>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <label htmlFor="email" className="font-mono-data text-[10px] text-[var(--text-muted)] tracking-wider uppercase">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@company.com"
                      className="w-full mt-2 mb-4 px-3.5 py-3 text-sm input-base"
                    />

                    {error && (
                      <div className="flex items-center gap-2 px-3 py-2 mb-4 rounded-lg bg-[var(--red-dim)] border border-[var(--red-border)]">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                        <p className="text-xs text-[var(--red)]">{error}</p>
                      </div>
                    )}

                    <button type="submit" disabled={loading} className="w-full py-3 text-sm btn-primary shadow-glow flex items-center justify-center gap-2 group">
                      {loading ? (
                        <>
                          <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="32" strokeDashoffset="12" /></svg>
                          Sending...
                        </>
                      ) : (
                        <>
                          Send Magic Link
                          <svg className="group-hover:translate-x-1 transition-transform" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                        </>
                      )}
                    </button>

                    <div className="flex items-center justify-center gap-2 mt-4 text-xs text-[var(--text-muted)]">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      Passwordless · No passwords to steal
                    </div>
                  </form>
                )}

                <p className="text-center text-[10px] text-[var(--text-muted)] mt-4 font-mono-data leading-relaxed">
                  No credit card required to sign up · Free to explore<br />Pay only when you pay your contractors
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-[rgba(255,255,255,0.05)] py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <FlashPayLogo size={28} />
            <FlashPayWordmark className="text-sm" />
            <span className="text-xs text-[var(--text-muted)] ml-3 font-mono-data">&copy; 2026</span>
          </div>
          <div className="text-xs text-[var(--text-muted)] font-mono-data">
            Built for the Dodo Payments &times; Superteam hackathon
          </div>
        </div>
      </footer>

    </div>
  );
}
