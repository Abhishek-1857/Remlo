-- PayPipe database schema
-- Run this in your Supabase SQL Editor

-- Contractors table
create table if not exists contractors (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  solana_wallet text not null,
  created_at timestamptz default now()
);

-- Payouts table
create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid not null references contractors(id) on delete cascade,
  amount_usd numeric not null,
  dodo_payment_id text unique,
  solana_tx_sig text,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz default now()
);

-- Enable RLS
alter table contractors enable row level security;
alter table payouts enable row level security;

-- Contractors: owner can CRUD their own
create policy "Users can view own contractors"
  on contractors for select
  using (auth.uid() = owner_id);

create policy "Users can insert own contractors"
  on contractors for insert
  with check (auth.uid() = owner_id);

create policy "Users can update own contractors"
  on contractors for update
  using (auth.uid() = owner_id);

create policy "Users can delete own contractors"
  on contractors for delete
  using (auth.uid() = owner_id);

-- Payouts: visible to the contractor's owner
create policy "Users can view own payouts"
  on payouts for select
  using (
    exists (
      select 1 from contractors
      where contractors.id = payouts.contractor_id
      and contractors.owner_id = auth.uid()
    )
  );

create policy "Users can insert own payouts"
  on payouts for insert
  with check (
    exists (
      select 1 from contractors
      where contractors.id = payouts.contractor_id
      and contractors.owner_id = auth.uid()
    )
  );

create policy "Users can update own payouts"
  on payouts for update
  using (
    exists (
      select 1 from contractors
      where contractors.id = payouts.contractor_id
      and contractors.owner_id = auth.uid()
    )
  );

-- Service role bypass for webhook handler (uses service role key, bypasses RLS)
-- No additional policies needed; service role key bypasses RLS by default.

-- Indexes
create index if not exists idx_contractors_owner on contractors(owner_id);
create index if not exists idx_payouts_contractor on payouts(contractor_id);
create index if not exists idx_payouts_dodo_payment on payouts(dodo_payment_id);
create index if not exists idx_payouts_status on payouts(status);
