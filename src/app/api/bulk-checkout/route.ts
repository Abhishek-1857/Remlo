import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { createBulkCheckoutSession } from "@/lib/dodo";

interface BulkItem {
  contractorId: string;
  amountUsd: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const items: BulkItem[] = body.items;

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No items provided" }, { status: 400 });
  }

  for (const item of items) {
    if (!item.contractorId || !item.amountUsd || item.amountUsd <= 0) {
      return NextResponse.json({ error: "Invalid item data" }, { status: 400 });
    }
  }

  const totalAmountUsd = items.reduce((sum, i) => sum + i.amountUsd, 0);
  const serviceClient = createServiceClient();

  const { data: bulkPayout, error: bulkError } = await serviceClient
    .from("bulk_payouts")
    .insert({
      owner_id: user.id,
      total_amount_usd: totalAmountUsd,
      status: "pending",
    })
    .select()
    .single();

  if (bulkError || !bulkPayout) {
    console.error("Failed to create bulk_payout:", bulkError);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  const itemInserts = items.map((i) => ({
    bulk_payout_id: bulkPayout.id,
    contractor_id: i.contractorId,
    amount_usd: i.amountUsd,
    status: "pending",
  }));

  const { error: itemsError } = await serviceClient
    .from("bulk_payout_items")
    .insert(itemInserts);

  if (itemsError) {
    console.error("Failed to create bulk_payout_items:", itemsError);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  try {
    const session = await createBulkCheckoutSession(
      bulkPayout.id,
      totalAmountUsd,
      user.email!,
      user.id
    );
    return NextResponse.json({ checkout_url: session.checkout_url });
  } catch (err) {
    console.error("Failed to create Dodo checkout:", err);
    return NextResponse.json({ error: "Checkout creation failed" }, { status: 500 });
  }
}
