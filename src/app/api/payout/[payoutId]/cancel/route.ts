import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(
  request: NextRequest,
  { params }: { params: { payoutId: string } }
) {
  const { payoutId } = params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: payout } = await supabase
    .from("payouts")
    .select("*, contractors(owner_id)")
    .eq("id", payoutId)
    .single();

  if (!payout || payout.contractors.owner_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payout.status !== "pending" && payout.status !== "processing") {
    return NextResponse.json(
      { error: "Only pending or processing payouts can be cancelled" },
      { status: 400 }
    );
  }

  const serviceClient = createServiceClient();
  await serviceClient
    .from("payouts")
    .update({ status: "failed", error_message: "Cancelled by user" })
    .eq("id", payoutId);

  return NextResponse.json({ success: true });
}
