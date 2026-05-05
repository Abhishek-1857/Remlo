import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  createTransferCheckedInstruction,
  getMint,
} from "@solana/spl-token";
import bs58 from "bs58";

const USDC_DEVNET_MINT = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);
const USDC_DECIMALS = 6;

function getConnection() {
  return new Connection(
    process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com",
    "confirmed"
  );
}

function getHotWallet(): Keypair {
  const key = process.env.SOLANA_HOT_WALLET_KEY;
  if (!key) throw new Error("SOLANA_HOT_WALLET_KEY not set");
  return Keypair.fromSecretKey(bs58.decode(key));
}

export async function sendUsdc(
  toAddress: string,
  amountUsd: number
): Promise<string> {
  const connection = getConnection();
  const hotWallet = getHotWallet();
  const recipient = new PublicKey(toAddress);

  const amountInSmallestUnit = BigInt(Math.round(amountUsd * 10 ** USDC_DECIMALS));

  const senderAta = await getOrCreateAssociatedTokenAccount(
    connection,
    hotWallet,
    USDC_DEVNET_MINT,
    hotWallet.publicKey
  );

  const recipientAta = await getOrCreateAssociatedTokenAccount(
    connection,
    hotWallet,
    USDC_DEVNET_MINT,
    recipient
  );

  const mint = await getMint(connection, USDC_DEVNET_MINT);

  const instruction = createTransferCheckedInstruction(
    senderAta.address,
    USDC_DEVNET_MINT,
    recipientAta.address,
    hotWallet.publicKey,
    amountInSmallestUnit,
    mint.decimals
  );

  const transaction = new Transaction().add(instruction);
  const signature = await sendAndConfirmTransaction(connection, transaction, [
    hotWallet,
  ]);

  return signature;
}
