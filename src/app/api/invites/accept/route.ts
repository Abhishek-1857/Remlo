import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { sendContractorOnboardedEmail } from "@/lib/emails";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { token, name, email, solana_wallet } = body;

  if (!token || !name || !email || !solana_wallet) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  if (!base58Regex.test(solana_wallet)) {
    return NextResponse.json({ error: "Invalid Solana wallet address" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: invite, error: fetchError } = await supabase
    .from("contractor_invites")
    .select("id, owner_id, owner_email, company_name, used, expires_at")
    .eq("token", token)
    .single();

  if (fetchError || !invite) {
    return NextResponse.json({ error: "Invalid invite link" }, { status: 404 });
  }

  if (invite.used) {
    return NextResponse.json({ error: "This invite has already been used" }, { status: 409 });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ error: "This invite has expired" }, { status: 410 });
  }

  const { data: contractor, error: contractorError } = await supabase
    .from("contractors")
    .insert({
      owner_id: invite.owner_id,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      solana_wallet: solana_wallet.trim(),
    })
    .select("id")
    .single();

  if (contractorError || !contractor) {
    console.error("Failed to insert contractor:", contractorError);
    return NextResponse.json({ error: "Failed to register contractor" }, { status: 500 });
  }

  await supabase
    .from("contractor_invites")
    .update({ used: true, contractor_id: contractor.id })
    .eq("id", invite.id);

  const appUrl = process.env.NEXT_PUBLIC_URL || "https://payzap-app.vercel.app";
  sendContractorOnboardedEmail({
    founderEmail: invite.owner_email,
    contractorName: name.trim(),
    contractorEmail: email.trim(),
    contractorWallet: solana_wallet.trim(),
    contractorId: contractor.id,
    appUrl,
  }).catch(() => {});

  return NextResponse.json({ success: true, contractor_id: contractor.id });
}
