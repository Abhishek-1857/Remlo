"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type PageState = "loading" | "invalid" | "used" | "expired" | "form" | "success";

interface InviteInfo {
  company_name: string | null;
  owner_email: string;
}

function Logo() {
  return (
    <div style={{ textAlign: "center", marginBottom: "32px" }}>
      <span style={{ fontSize: "22px", fontWeight: 900, color: "#00E6A0", letterSpacing: "-0.5px", fontFamily: "sans-serif" }}>
        Remlo
      </span>
    </div>
  );
}

function ErrorState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div style={{ textAlign: "center", padding: "40px 0" }}>
      <div style={{ width: 56, height: 56, borderRadius: "50%", background: "rgba(224,82,82,0.12)", border: "1px solid rgba(224,82,82,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E05252" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      </div>
      <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#F2F2F3" }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 14, color: "#8A8A96" }}>{subtitle}</p>
    </div>
  );
}

function SuccessState({ wallet, companyName }: { name: string; wallet: string; companyName: string | null }) {
  const truncated = `${wallet.slice(0, 6)}...${wallet.slice(-6)}`;
  return (
    <div style={{ textAlign: "center", padding: "32px 0" }}>
      {/* Animated checkmark */}
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(0,230,160,0.1)", border: "2px solid rgba(0,230,160,0.3)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px", animation: "scaleIn 0.4s ease" }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#00E6A0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ animation: "drawCheck 0.4s ease 0.2s both" }}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </div>

      <h2 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 800, color: "#F2F2F3" }}>You&apos;re all set!</h2>
      <p style={{ margin: "0 0 28px", fontSize: 14, color: "#8A8A96", lineHeight: 1.6 }}>
        Your wallet has been registered.{" "}
        {companyName ? <><span style={{ color: "#C0C0CC" }}>{companyName}</span> can</> : "Your employer can"}{" "}
        now send you payments directly to your Solana wallet.
      </p>

      {/* Wallet display */}
      <div style={{ background: "#161618", border: "1px solid #2A2A30", borderRadius: 8, padding: "12px 16px", marginBottom: 20 }}>
        <p style={{ margin: "0 0 4px", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4A5A74" }}>Your registered wallet</p>
        <p style={{ margin: 0, fontFamily: "monospace", fontSize: 14, color: "#00E6A0", fontWeight: 600 }}>{truncated}</p>
      </div>

      {/* Info box */}
      <div style={{ background: "rgba(0,230,160,0.05)", border: "1px solid rgba(0,230,160,0.15)", borderRadius: 8, padding: "12px 16px", textAlign: "left" }}>
        <p style={{ margin: 0, fontSize: 13, color: "#8A8A96", lineHeight: 1.6 }}>
          <span style={{ color: "#00E6A0" }}>ℹ</span> You&apos;ll receive an email confirmation when a payment is sent to you.
        </p>
      </div>

      <style>{`
        @keyframes scaleIn {
          from { transform: scale(0.6); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

export default function InvitePage() {
  const params = useParams();
  const token = params.token as string;

  const [pageState, setPageState] = useState<PageState>("loading");
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [wallet, setWallet] = useState("");
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successName, setSuccessName] = useState("");

  useEffect(() => {
    fetch(`/api/invites/validate?token=${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.valid) {
          if (data.reason === "used") setPageState("used");
          else if (data.reason === "expired") setPageState("expired");
          else setPageState("invalid");
        } else {
          setInvite({ company_name: data.company_name, owner_email: data.owner_email });
          setPageState("form");
        }
      })
      .catch(() => setPageState("invalid"));
  }, [token]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");

    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(wallet.trim())) {
      setFormError("Invalid Solana wallet address — please check and try again.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/invites/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, name: name.trim(), email: email.trim(), solana_wallet: wallet.trim() }),
    });
    const data = await res.json();

    if (res.ok) {
      setSuccessName(name.trim());
      setPageState("success");
    } else {
      setFormError(data.error || "Something went wrong. Please try again.");
      setSubmitting(false);
    }
  }

  const companyName = invite?.company_name;

  return (
    <div style={{ minHeight: "100vh", background: "#080C14", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
      <div style={{ width: "100%", maxWidth: 480 }}>
        <Logo />

        <div style={{ background: "#111113", border: "1px solid #1E1E24", borderRadius: 16, padding: "36px 32px" }}>

          {pageState === "loading" && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#8A8A96", fontSize: 14 }}>
              Checking invite...
            </div>
          )}

          {pageState === "invalid" && (
            <ErrorState
              title="Invalid invite link"
              subtitle="This invite link doesn't exist or has been removed."
            />
          )}

          {pageState === "used" && (
            <ErrorState
              title="Invite already used"
              subtitle="This invite link has already been used. Ask your employer for a new one."
            />
          )}

          {pageState === "expired" && (
            <ErrorState
              title="Invite link expired"
              subtitle="This invite link has expired. Ask your employer for a new one."
            />
          )}

          {pageState === "form" && (
            <>
              <h1 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 800, color: "#F2F2F3", lineHeight: 1.3 }}>
                {companyName
                  ? <>You&apos;ve been invited to join <span style={{ color: "#00E6A0" }}>{companyName}</span>&apos;s contractor network</>
                  : "You've been invited to join a contractor network"}
              </h1>
              <p style={{ margin: "0 0 28px", fontSize: 13, color: "#8A8A96", lineHeight: 1.6 }}>
                Fill in your details to receive payments via Remlo.
              </p>

              <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 18 }}>
                {/* Name */}
                <div>
                  <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4A5A74", marginBottom: 6, fontWeight: 600 }}>
                    Full Name *
                  </label>
                  <input
                    required
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Jane Smith"
                    style={{ width: "100%", background: "#161618", border: "1px solid #2A2A30", borderRadius: 8, padding: "11px 14px", fontSize: 14, color: "#F2F2F3", outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                {/* Email */}
                <div>
                  <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4A5A74", marginBottom: 6, fontWeight: 600 }}>
                    Email Address *
                  </label>
                  <input
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="jane@example.com"
                    style={{ width: "100%", background: "#161618", border: "1px solid #2A2A30", borderRadius: 8, padding: "11px 14px", fontSize: 14, color: "#F2F2F3", outline: "none", boxSizing: "border-box" }}
                  />
                </div>

                {/* Wallet */}
                <div>
                  <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "#4A5A74", marginBottom: 6, fontWeight: 600 }}>
                    Solana Wallet Address *
                  </label>
                  <input
                    required
                    type="text"
                    value={wallet}
                    onChange={(e) => setWallet(e.target.value)}
                    placeholder="e.g. 7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
                    style={{ width: "100%", background: "#161618", border: "1px solid #2A2A30", borderRadius: 8, padding: "11px 14px", fontSize: 13, color: "#F2F2F3", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                  />
                  <p style={{ margin: "8px 0 0", fontSize: 12, color: "#4A5A74", lineHeight: 1.5 }}>
                    Don&apos;t have one?{" "}
                    <a href="https://phantom.app" target="_blank" rel="noopener noreferrer" style={{ color: "#00E6A0", textDecoration: "none" }}>
                      Download Phantom wallet at phantom.app
                    </a>{" "}
                    — it&apos;s free and takes 2 minutes.
                  </p>
                </div>

                {/* Info box */}
                <div style={{ background: "rgba(0,230,160,0.05)", border: "1px solid rgba(0,230,160,0.12)", borderRadius: 8, padding: "12px 14px" }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#8A8A96", lineHeight: 1.6 }}>
                    <span style={{ color: "#00E6A0", fontWeight: 700 }}>What is a Solana wallet?</span>{" "}
                    Your Solana wallet is where you&apos;ll receive USDC payments. It&apos;s like a bank account but on the blockchain — instant transfers, no fees.
                  </p>
                </div>

                {formError && (
                  <p style={{ margin: 0, fontSize: 13, color: "#E05252", background: "rgba(224,82,82,0.08)", border: "1px solid rgba(224,82,82,0.2)", borderRadius: 8, padding: "10px 14px" }}>
                    {formError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  style={{ width: "100%", padding: "13px", background: submitting ? "#0D2E1F" : "#00E6A0", color: submitting ? "#00E6A0" : "#0A0A0B", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", transition: "background 0.2s", marginTop: 4 }}
                >
                  {submitting ? "Registering..." : "Join & Get Paid"}
                </button>
              </form>
            </>
          )}

          {pageState === "success" && (
            <SuccessState
              name={successName}
              wallet={wallet}
              companyName={companyName ?? null}
            />
          )}
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 12, color: "#3A4A66" }}>
          Powered by Remlo · Your payment details are stored securely
        </p>
      </div>
    </div>
  );
}
