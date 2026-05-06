import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get this user's bulk payout IDs (RLS filters by owner_id)
  const { data: bulkPayouts, error: bpError } = await supabase
    .from("bulk_payouts")
    .select("id")
    .order("created_at", { ascending: false });

  if (bpError) {
    return NextResponse.json({ error: bpError.message }, { status: 500 });
  }

  if (!bulkPayouts || bulkPayouts.length === 0) {
    return NextResponse.json({ error: "No bulk payouts to export" }, { status: 404 });
  }

  const bulkIds = bulkPayouts.map((b) => b.id);
  const serviceClient = createServiceClient();

  const { data: items, error: itemsError } = await serviceClient
    .from("bulk_payout_items")
    .select("*, contractors(name, email, solana_wallet)")
    .in("bulk_payout_id", bulkIds)
    .order("created_at", { ascending: false });

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "No bulk payout items to export" }, { status: 404 });
  }

  const headers = [
    "Bulk Payout ID",
    "Date",
    "Contractor Name",
    "Contractor Email",
    "Contractor Wallet",
    "Amount (USD)",
    "Status",
    "Solana TX Hash",
    "Solscan Link",
    "Network Fee",
  ];

  const rows = items.map((item) => {
    const date = new Date(item.created_at).toISOString().replace("T", " ").slice(0, 19);
    const contractor = item.contractors as { name: string; email: string | null; solana_wallet: string } | null;
    const name = contractor?.name || "";
    const email = contractor?.email || "";
    const wallet = contractor?.solana_wallet || "";
    const amount = Number(item.amount_usd).toFixed(2);
    const status = item.status;
    const txHash = item.solana_tx_sig || "";
    const solscanLink = txHash ? `https://solscan.io/tx/${txHash}?cluster=devnet` : "";
    const fee = txHash ? "~$0.001" : "";

    return [item.bulk_payout_id, date, name, email, wallet, amount, status, txHash, solscanLink, fee]
      .map(escapeCSV)
      .join(",");
  });

  const totalDone = items
    .filter((i) => i.status === "done")
    .reduce((sum, i) => sum + Number(i.amount_usd), 0);

  const summaryRow = `TOTAL,,,,,,${totalDone.toFixed(2)},,,`;

  const csv = [headers.join(","), ...rows, summaryRow].join("\n");

  const today = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="flashpay-bulk-payouts-${today}.csv"`,
    },
  });
}
