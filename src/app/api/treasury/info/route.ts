import { NextResponse } from "next/server";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { AccountLayout } from "@solana/spl-token";
import bs58 from "bs58";
import { createClient } from "@/lib/supabase/server";

const USDC_MINT = new PublicKey("XBouzXTNYLEqmVG8P3EHhvTHLWzMD84hNmoZYktihcS");
const USDC_DECIMALS = 6;

function getThresholds() {
  return {
    low: Number(process.env.TREASURY_LOW_THRESHOLD_USD ?? 500),
    critical: Number(process.env.TREASURY_CRITICAL_THRESHOLD_USD ?? 100),
  };
}

function getTier(balance: number, pending: number, low: number, critical: number) {
  if (balance < pending) return "insufficient";
  if (balance < critical) return "critical";
  if (balance < low) return "low";
  return "healthy";
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ownerEmail = (process.env.TREASURY_OWNER_EMAIL || "").toLowerCase();
  const isOwner = ownerEmail ? user.email?.toLowerCase() === ownerEmail : true;

  const key = process.env.SOLANA_HOT_WALLET_KEY;
  if (!key) {
    return NextResponse.json({ error: "Wallet not configured" }, { status: 500 });
  }

  let balance = 0;
  let solBalance = 0;
  let walletAddress = "";
  let fullAddress = "";
  let cluster: "devnet" | "mainnet-beta" = "devnet";
  const rpcUrl = process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com";
  let rpcError = false;

  try {
    const wallet = Keypair.fromSecretKey(bs58.decode(key));
    fullAddress = wallet.publicKey.toBase58();
    walletAddress = `${fullAddress.slice(0, 6)}...${fullAddress.slice(-6)}`;

    cluster = rpcUrl.includes("mainnet") ? "mainnet-beta" : "devnet";
    const connection = new Connection(rpcUrl, "confirmed");

    const [{ value: tokenAccounts }, lamports] = await Promise.all([
      connection.getTokenAccountsByOwner(wallet.publicKey, { mint: USDC_MINT }),
      connection.getBalance(wallet.publicKey),
    ]);

    if (tokenAccounts.length > 0) {
      const accountData = AccountLayout.decode(tokenAccounts[0].account.data);
      balance = Number(accountData.amount) / 10 ** USDC_DECIMALS;
    }
    solBalance = lamports / 1e9;
  } catch (err) {
    console.error("[treasury/info] RPC error", err);
    rpcError = true;
  }

  const { data: pendingPayouts } = await supabase
    .from("payouts")
    .select("amount_usd")
    .in("status", ["pending", "processing"]);

  const pendingSum =
    pendingPayouts?.reduce((s, p) => s + Number(p.amount_usd), 0) ?? 0;
  const pendingCount = pendingPayouts?.length ?? 0;

  const { data: doneRecent } = await supabase
    .from("payouts")
    .select("amount_usd")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(50);

  const avgPayout =
    doneRecent && doneRecent.length > 0
      ? doneRecent.reduce((s, p) => s + Number(p.amount_usd), 0) / doneRecent.length
      : 0;

  const available = Math.max(0, balance - pendingSum);
  const runwayCount = avgPayout > 0 ? Math.floor(available / avgPayout) : null;

  const { data: lastDone } = await supabase
    .from("payouts")
    .select("created_at, amount_usd, contractors(name)")
    .eq("status", "done")
    .order("created_at", { ascending: false })
    .limit(8);

  // Outflow chart: last 30 days, grouped by day
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const { data: chartRows } = await supabase
    .from("payouts")
    .select("created_at, amount_usd")
    .eq("status", "done")
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: true });

  const dailyOutflow: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    const key = d.toISOString().split("T")[0];
    dailyOutflow[key] = 0;
  }
  for (const row of chartRows ?? []) {
    const key = new Date(row.created_at).toISOString().split("T")[0];
    if (key in dailyOutflow) dailyOutflow[key] += Number(row.amount_usd);
  }
  const outflowChart = Object.entries(dailyOutflow).map(([date, amount]) => ({ date, amount }));

  // Policy from env (with defaults)
  const policy = {
    spendCapDaily: Number(process.env.TREASURY_SPEND_CAP_DAILY_USD ?? 1000),
    txLimit: Number(process.env.TREASURY_TX_LIMIT_USD ?? 300),
    autoRefill: process.env.TREASURY_AUTO_REFILL === "true",
    notifyOnPayout: process.env.TREASURY_NOTIFY_PAYOUT !== "false",
    notifyOnLow: process.env.TREASURY_NOTIFY_LOW !== "false",
  };

  // Multi-sig info (defaults to 2/3 for demo; integrate Squads.so for real multi-sig)
  const multisig = {
    enabled: process.env.TREASURY_MULTISIG !== "false",
    threshold: Number(process.env.TREASURY_MULTISIG_THRESHOLD ?? 2),
    signers: Number(process.env.TREASURY_MULTISIG_SIGNERS ?? 3),
  };

  // Today's spend (for spend cap progress)
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { data: todayPayouts } = await supabase
    .from("payouts")
    .select("amount_usd")
    .eq("status", "done")
    .gte("created_at", startOfDay.toISOString());
  const todaySpent = todayPayouts?.reduce((s, p) => s + Number(p.amount_usd), 0) ?? 0;

  // Avg confirmation time (from settlement_ms)
  const { data: confirmationsData } = await supabase
    .from("payouts")
    .select("settlement_ms")
    .eq("status", "done")
    .not("settlement_ms", "is", null)
    .order("created_at", { ascending: false })
    .limit(50);
  const avgConfirmMs =
    confirmationsData && confirmationsData.length > 0
      ? confirmationsData.reduce((s, p) => s + (p.settlement_ms || 0), 0) / confirmationsData.length
      : 0;

  const { low, critical } = getThresholds();
  const tier = getTier(balance, pendingSum, low, critical);

  const usdcMintShort = `${USDC_MINT.toBase58().slice(0, 4)}...${USDC_MINT.toBase58().slice(-4)}`;

  return NextResponse.json({
    balance,
    solBalance,
    available,
    pendingSum,
    pendingCount,
    avgPayout,
    runwayCount,
    walletAddress,
    fullAddress,
    cluster,
    rpcUrl,
    usdcMint: USDC_MINT.toBase58(),
    usdcMintShort,
    rpcError,
    tier,
    thresholds: { low, critical },
    isOwner,
    ownerEmail: isOwner ? ownerEmail : maskEmail(ownerEmail),
    recentPayouts: lastDone ?? [],
    outflowChart,
    policy,
    multisig,
    todaySpent,
    avgConfirmMs,
    syncedAt: new Date().toISOString(),
  });
}

function maskEmail(email: string) {
  if (!email) return null;
  const [name, domain] = email.split("@");
  if (!domain) return null;
  const masked = name.slice(0, 2) + "***";
  return `${masked}@${domain}`;
}
