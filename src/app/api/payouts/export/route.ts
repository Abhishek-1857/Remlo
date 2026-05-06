import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: payouts, error } = await supabase
    .from("payouts")
    .select("*, contractors(name, email, solana_wallet, owner_id)")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!payouts || payouts.length === 0) {
    return NextResponse.json({ error: "No payouts to export" }, { status: 404 });
  }

  const headers = [
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

  const rows = payouts.map((p) => {
    const date = new Date(p.created_at).toISOString().replace("T", " ").slice(0, 19);
    const name = p.contractors?.name || "";
    const email = p.contractors?.email || "";
    const wallet = p.contractors?.solana_wallet || "";
    const amount = Number(p.amount_usd).toFixed(2);
    const status = p.status;
    const txHash = p.solana_tx_sig || "";
    const solscanLink = txHash ? `https://solscan.io/tx/${txHash}?cluster=devnet` : "";
    const fee = txHash ? "~$0.001" : "";

    return [date, name, email, wallet, amount, status, txHash, solscanLink, fee]
      .map(escapeCSV)
      .join(",");
  });

  const totalDone = payouts
    .filter((p) => p.status === "done")
    .reduce((sum, p) => sum + Number(p.amount_usd), 0);

  const summaryRow = `TOTAL,,,,,${totalDone.toFixed(2)},,,`;

  const csv = [headers.join(","), ...rows, summaryRow].join("\n");

  const today = new Date().toISOString().split("T")[0];

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="flashpay-payouts-${today}.csv"`,
    },
  });
}
