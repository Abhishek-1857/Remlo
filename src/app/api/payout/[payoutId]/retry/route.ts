import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { sendUsdc } from "@/lib/solana";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ payoutId: string }> }
) {
  const { payoutId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: payout } = await supabase
    .from("payouts")
    .select("*, contractors(solana_wallet, owner_id)")
    .eq("id", payoutId)
    .single();

  if (!payout || payout.contractors.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payout.status !== "failed") {
    return NextResponse.json(
      { error: "Only failed payouts can be retried" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();

  await serviceClient
    .from("payouts")
    .update({ status: "processing", error_message: null })
    .eq("id", payoutId);

  try {
    const txSig = await sendUsdc(
      payout.contractors.solana_wallet,
      payout.amount_usd
    );
    await serviceClient
      .from("payouts")
      .update({ status: "done", solana_tx_sig: txSig })
      .eq("id", payoutId);

    return NextResponse.json({ success: true, tx_sig: txSig });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await serviceClient
      .from("payouts")
      .update({ status: "failed", error_message: message })
      .eq("id", payoutId);

    return NextResponse.json(
      { error: "Transfer failed", message },
      { status: 500 }
    );
  }
}
