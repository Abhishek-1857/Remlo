-- Add settlement_ms column to track actual Solana settlement time per payout
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS settlement_ms integer;
