import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerEmail = (process.env.TREASURY_OWNER_EMAIL || "").toLowerCase();
  if (!ownerEmail) {
    return NextResponse.json(
      { error: "Treasury owner not configured" },
      { status: 500 }
    );
  }

  if (user.email?.toLowerCase() === ownerEmail) {
    return NextResponse.json(
      { error: "You are the treasury owner — refill directly" },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { amount, balance, note, urgency } = body as {
    amount?: number;
    balance?: number;
    note?: string;
    urgency?: "normal" | "urgent" | "critical";
  };

  if (!amount || amount <= 0 || amount > 1_000_000) {
    return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
  }

  const requesterEmail = user.email || "unknown";
  const requesterName = user.user_metadata?.full_name || requesterEmail.split("@")[0];
  const safeNote = (note || "").slice(0, 500);
  const origin =
    request.headers.get("origin") ||
    (request.headers.get("host")
      ? `${request.headers.get("x-forwarded-proto") || "http"}://${request.headers.get("host")}`
      : null);
  const appUrl = origin || process.env.NEXT_PUBLIC_URL || "https://payzap-app.vercel.app";

  const isUrgent = urgency === "urgent" || urgency === "critical";
  const subject = isUrgent
    ? `🚨 Urgent: Treasury refill requested — $${amount.toFixed(0)} USDC`
    : `Treasury refill requested — $${amount.toFixed(0)} USDC`;

  const html = buildEmail({
    requesterName,
    requesterEmail,
    amount,
    balance: balance ?? 0,
    note: safeNote,
    urgency: urgency || "normal",
    appUrl,
  });

  try {
    const { data, error } = await resend.emails.send({
      from: FROM,
      to: ownerEmail,
      subject,
      html,
      replyTo: requesterEmail,
    });
    if (error) {
      console.error("[treasury/request-refill] Resend error:", error);
      return NextResponse.json(
        { error: error.message || "Email provider rejected the request" },
        { status: 500 }
      );
    }
    console.log("[treasury/request-refill] sent", {
      id: data?.id,
      to: ownerEmail,
      from: FROM,
      requester: requesterEmail,
      amount,
    });
  } catch (err) {
    console.error("[treasury/request-refill] email failed", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

function buildEmail({
  requesterName,
  requesterEmail,
  amount,
  balance,
  note,
  urgency,
  appUrl,
}: {
  requesterName: string;
  requesterEmail: string;
  amount: number;
  balance: number;
  note: string;
  urgency: string;
  appUrl: string;
}) {
  const urgencyBanner =
    urgency === "critical"
      ? `<div style="background:#7F1D1D;color:#FCA5A5;padding:12px 16px;border-radius:8px;margin-bottom:24px;font-weight:600;">🚨 CRITICAL: Treasury balance is below the critical threshold. Payouts may fail.</div>`
      : urgency === "urgent"
      ? `<div style="background:#78350F;color:#FCD34D;padding:12px 16px;border-radius:8px;margin-bottom:24px;font-weight:600;">⚠️ URGENT: Treasury balance is low.</div>`
      : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#0A0A0B;font-family:Arial,sans-serif;color:#E8ECF4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#111113;border-radius:12px;border:1px solid #1E1E24;overflow:hidden;">
        <tr><td style="padding:32px;">
          ${urgencyBanner}
          <h1 style="margin:0 0 8px;color:#00E6A0;font-size:22px;">Treasury refill requested</h1>
          <p style="margin:0 0 24px;color:#8B92A5;font-size:14px;">${requesterName} is asking you to top up the Payzap treasury wallet.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0B;border-radius:8px;margin:0 0 20px;">
            <tr>
              <td style="padding:16px;border-bottom:1px solid #1E1E24;">
                <p style="margin:0;color:#8B92A5;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Requested amount</p>
                <p style="margin:4px 0 0;color:#00E6A0;font-size:24px;font-weight:700;">$${amount.toFixed(2)} USDC</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px;border-bottom:1px solid #1E1E24;">
                <p style="margin:0;color:#8B92A5;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Current balance</p>
                <p style="margin:4px 0 0;color:#E8ECF4;font-size:18px;">$${balance.toFixed(2)} USDC</p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px;">
                <p style="margin:0;color:#8B92A5;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Requested by</p>
                <p style="margin:4px 0 0;color:#E8ECF4;font-size:14px;">${requesterName} &lt;${requesterEmail}&gt;</p>
              </td>
            </tr>
          </table>

          ${
            note
              ? `<div style="background:#0A0A0B;border-left:3px solid #00E6A0;padding:12px 16px;margin:0 0 24px;border-radius:0 6px 6px 0;">
                  <p style="margin:0 0 4px;color:#8B92A5;font-size:11px;text-transform:uppercase;letter-spacing:0.08em;">Note</p>
                  <p style="margin:0;color:#E8ECF4;font-size:14px;line-height:1.5;">${escapeHtml(note)}</p>
                </div>`
              : ""
          }

          <a href="${appUrl}/treasury" style="display:inline-block;background:#00E6A0;color:#080C14;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;">Open treasury</a>

          <p style="margin:32px 0 0;color:#5A6178;font-size:11px;">Reply to this email to respond to ${requesterName}.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
