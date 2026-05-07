import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { createServiceClient } from "@/lib/supabase/server";
import { sendUsdc } from "@/lib/solana";
import { sendPayoutEmails, sendBulkPayoutSummaryEmail } from "@/lib/emails";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key] = value;
  });

  try {
    const wh = new Webhook(process.env.DODO_WEBHOOK_KEY!);
    wh.verify(body, headers);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const event = JSON.parse(body);

  if (event.type !== "payment.succeeded") {
    return NextResponse.json({ received: true });
  }

  const payment = event.data;
  const metadata = payment.metadata || {};
  const paymentId = payment.payment_id;
  const ownerId = metadata.owner_id;

  const supabase = createServiceClient();

  // ── Bulk payout flow ─────────────────────────────────────────────────────
  if (metadata.is_bulk === "true") {
    const bulkPayoutId = metadata.bulk_payout_id;

    if (!bulkPayoutId || !paymentId) {
      return NextResponse.json({ error: "Missing bulk metadata" }, { status: 400 });
    }

    // Idempotency: skip if already processed
    const { data: existingBulk } = await supabase
      .from("bulk_payouts")
      .select("id, status")
      .eq("id", bulkPayoutId)
      .single();

    if (existingBulk?.status === "done") {
      return NextResponse.json({ received: true, duplicate: true });
    }

    await supabase
      .from("bulk_payouts")
      .update({ dodo_payment_id: paymentId, status: "processing" })
      .eq("id", bulkPayoutId);

    const { data: items } = await supabase
      .from("bulk_payout_items")
      .select("id, contractor_id, amount_usd, contractors(name, email, solana_wallet)")
      .eq("bulk_payout_id", bulkPayoutId);

    if (!items || items.length === 0) {
      await supabase.from("bulk_payouts").update({ status: "failed" }).eq("id", bulkPayoutId);
      return NextResponse.json({ error: "No items found" }, { status: 400 });
    }

    // Process each item
    const txResults: Array<{ name: string; amountUsd: number; txSig: string | null; error?: string }> = [];

    for (const item of items) {
      const rawContractor = item.contractors;
      const contractor = (Array.isArray(rawContractor) ? rawContractor[0] : rawContractor) as { name: string; email: string | null; solana_wallet: string } | null;

      if (!contractor) {
        await supabase
          .from("bulk_payout_items")
          .update({ status: "failed", error_message: "Contractor not found" })
          .eq("id", item.id);
        txResults.push({ name: "Unknown", amountUsd: Number(item.amount_usd), txSig: null, error: "Contractor not found" });
        continue;
      }

      try {
        const sentAt = Date.now();
        const txSig = await sendUsdc(contractor.solana_wallet, Number(item.amount_usd));
        const settlementMs = Date.now() - sentAt;

        await supabase.from("bulk_payout_items").update({ status: "done", solana_tx_sig: txSig }).eq("id", item.id);

        // Update pre-inserted processing row; fall back to insert if missing
        const { data: updatedRows } = await supabase
          .from("payouts")
          .update({ status: "done", solana_tx_sig: txSig, dodo_payment_id: `${paymentId}_${item.id}`, settlement_ms: settlementMs })
          .eq("bulk_payout_id", bulkPayoutId)
          .eq("contractor_id", item.contractor_id)
          .eq("status", "processing")
          .select("id");

        if (!updatedRows || updatedRows.length === 0) {
          await supabase.from("payouts").insert({
            contractor_id: item.contractor_id,
            amount_usd: item.amount_usd,
            dodo_payment_id: `${paymentId}_${item.id}`,
            bulk_payout_id: bulkPayoutId,
            status: "done",
            solana_tx_sig: txSig,
            settlement_ms: settlementMs,
          });
        }

        txResults.push({ name: contractor.name, amountUsd: Number(item.amount_usd), txSig });

        // Fire-and-forget per-contractor email
        if (contractor.email) {
          sendPayoutEmails({
            contractorName: contractor.name,
            contractorEmail: contractor.email,
            founderEmail: payment.customer?.email || "",
            amountUsd: Number(item.amount_usd),
            solanaSignature: txSig,
            cluster: "devnet",
            settlementMs,
          }).catch(() => {});
        }
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await supabase
          .from("bulk_payout_items")
          .update({ status: "failed", error_message: message })
          .eq("id", item.id);
        txResults.push({ name: contractor.name, amountUsd: Number(item.amount_usd), txSig: null, error: message });
      }
    }

    await supabase.from("bulk_payouts").update({ status: "done" }).eq("id", bulkPayoutId);

    // Summary email to founder
    let founderEmail = payment.customer?.email as string | undefined;
    if (!founderEmail && ownerId) {
      const { data: user } = await supabase.auth.admin.getUserById(ownerId);
      founderEmail = user?.user?.email;
    }

    if (founderEmail) {
      sendBulkPayoutSummaryEmail({
        founderEmail,
        items: txResults,
        totalAmountUsd: txResults.reduce((s, r) => s + r.amountUsd, 0),
      })
        .then(async () => {
          await supabase.from("bulk_payouts").update({ emails_sent: true }).eq("id", bulkPayoutId);
        })
        .catch(() => {});
    }

    return NextResponse.json({ received: true });
  }

  // ── Single payout flow ───────────────────────────────────────────────────
  const contractorId = metadata.contractor_id;
  const amountUsd = parseFloat(metadata.amount_usd);
  const preInsertedPayoutId = metadata.payout_id;

  if (!contractorId || !amountUsd || !paymentId) {
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  // Idempotency: skip if already processed
  const { data: existing } = await supabase
    .from("payouts")
    .select("id")
    .eq("dodo_payment_id", paymentId)
    .single();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  // Try to update the pre-inserted processing row; fall back to insert for older sessions
  let payoutId: string;
  if (preInsertedPayoutId) {
    const { data: updated, error: updateError } = await supabase
      .from("payouts")
      .update({ dodo_payment_id: paymentId, status: "processing" })
      .eq("id", preInsertedPayoutId)
      .select()
      .single();

    if (updateError || !updated) {
      console.error("Failed to update pre-inserted payout:", updateError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
    payoutId = updated.id;
  } else {
    const { data: inserted, error: insertError } = await supabase
      .from("payouts")
      .insert({ contractor_id: contractorId, amount_usd: amountUsd, dodo_payment_id: paymentId, status: "processing" })
      .select()
      .single();

    if (insertError || !inserted) {
      console.error("Failed to insert payout:", insertError);
      return NextResponse.json({ error: "DB error" }, { status: 500 });
    }
    payoutId = inserted.id;
  }

  const payout = { id: payoutId };

  const { data: contractor } = await supabase
    .from("contractors")
    .select("solana_wallet, name, email")
    .eq("id", contractorId)
    .single();

  if (!contractor) {
    await supabase
      .from("payouts")
      .update({ status: "failed", error_message: "Contractor not found" })
      .eq("id", payout.id);
    return NextResponse.json({ error: "Contractor not found" }, { status: 400 });
  }

  let txSig: string | null = null;
  let settlementMs: number | undefined;

  try {
    const sentAt = Date.now();
    txSig = await sendUsdc(contractor.solana_wallet, amountUsd);
    settlementMs = Date.now() - sentAt;
    await supabase
      .from("payouts")
      .update({ status: "done", solana_tx_sig: txSig, settlement_ms: settlementMs })
      .eq("id", payout.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("payouts")
      .update({ status: "failed", error_message: message })
      .eq("id", payout.id);
    return NextResponse.json({ received: true });
  }

  if (txSig) {
    let founderEmail = payment.customer?.email as string | undefined;

    if (!founderEmail && ownerId) {
      const { data: user } = await supabase.auth.admin.getUserById(ownerId);
      founderEmail = user?.user?.email;
    }

    if (founderEmail) {
      sendPayoutEmails({
        contractorName: contractor.name,
        contractorEmail: contractor.email ?? null,
        founderEmail,
        amountUsd,
        solanaSignature: txSig,
        cluster: "devnet",
        settlementMs,
      }).then(async () => {
        await supabase
          .from("payouts")
          .update({ emails_sent: true })
          .eq("id", payout.id);
      });
    }
  }

  return NextResponse.json({ received: true });
}
