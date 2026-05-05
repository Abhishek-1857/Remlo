import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "standardwebhooks";
import { createServiceClient } from "@/lib/supabase/server";
import { sendUsdc } from "@/lib/solana";

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
  const contractorId = metadata.contractor_id;
  const amountUsd = parseFloat(metadata.amount_usd);
  const paymentId = payment.payment_id;

  if (!contractorId || !amountUsd || !paymentId) {
    return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("payouts")
    .select("id")
    .eq("dodo_payment_id", paymentId)
    .single();

  if (existing) {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const { data: payout, error: insertError } = await supabase
    .from("payouts")
    .insert({
      contractor_id: contractorId,
      amount_usd: amountUsd,
      dodo_payment_id: paymentId,
      status: "processing",
    })
    .select()
    .single();

  if (insertError) {
    console.error("Failed to insert payout:", insertError);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const { data: contractor } = await supabase
    .from("contractors")
    .select("solana_wallet")
    .eq("id", contractorId)
    .single();

  if (!contractor) {
    await supabase
      .from("payouts")
      .update({ status: "failed", error_message: "Contractor not found" })
      .eq("id", payout.id);
    return NextResponse.json({ error: "Contractor not found" }, { status: 400 });
  }

  try {
    const txSig = await sendUsdc(contractor.solana_wallet, amountUsd);
    await supabase
      .from("payouts")
      .update({ status: "done", solana_tx_sig: txSig })
      .eq("id", payout.id);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await supabase
      .from("payouts")
      .update({ status: "failed", error_message: message })
      .eq("id", payout.id);
  }

  return NextResponse.json({ received: true });
}
