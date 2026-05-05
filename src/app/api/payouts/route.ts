import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const contractorId = request.nextUrl.searchParams.get("contractorId");

  let query = supabase
    .from("payouts")
    .select("*, contractors(name, solana_wallet, owner_id)")
    .order("created_at", { ascending: false });

  if (contractorId) {
    query = query.eq("contractor_id", contractorId);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
