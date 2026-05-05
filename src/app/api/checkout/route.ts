import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createCheckoutSession } from "@/lib/dodo";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { contractorId, amountUsd } = await request.json();

  if (!contractorId || !amountUsd || amountUsd < 1 || amountUsd > 10000) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const { data: contractor } = await supabase
    .from("contractors")
    .select("id")
    .eq("id", contractorId)
    .single();

  if (!contractor) {
    return NextResponse.json({ error: "Contractor not found" }, { status: 404 });
  }

  try {
    const session = await createCheckoutSession(
      contractorId,
      amountUsd,
      user.email!,
      user.id
    );

    return NextResponse.json({ checkout_url: session.checkout_url });
  } catch (err) {
    console.error("Checkout error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout" },
      { status: 500 }
    );
  }
}
