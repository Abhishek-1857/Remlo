-- bulk_payouts: one row per bulk checkout session
create table if not exists bulk_payouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id),
  total_amount_usd numeric not null,
  dodo_payment_id text unique,
  status text not null default 'pending',
  emails_sent boolean default false,
  created_at timestamptz not null default now()
);

-- bulk_payout_items: one row per contractor in a bulk run
create table if not exists bulk_payout_items (
  id uuid primary key default gen_random_uuid(),
  bulk_payout_id uuid not null references bulk_payouts(id) on delete cascade,
  contractor_id uuid not null references contractors(id),
  amount_usd numeric not null,
  solana_tx_sig text,
  status text not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

-- track which individual payout rows came from a bulk run
alter table payouts add column if not exists bulk_payout_id uuid references bulk_payouts(id);

-- RLS
alter table bulk_payouts enable row level security;
alter table bulk_payout_items enable row level security;

create policy "owners can manage their bulk payouts"
  on bulk_payouts for all
  using (owner_id = auth.uid());

create policy "owners can manage their bulk payout items"
  on bulk_payout_items for all
  using (
    exists (
      select 1 from bulk_payouts bp
      where bp.id = bulk_payout_items.bulk_payout_id
        and bp.owner_id = auth.uid()
    )
  );
