create table public.fund_accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_id uuid not null references public.funds(id) on delete cascade,
  name text not null,
  balance numeric(14,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.transactions
  add column fund_account_id uuid references public.fund_accounts(id) on delete set null,
  add column destination_fund_account_id uuid references public.fund_accounts(id) on delete set null;

alter table public.fund_accounts enable row level security;

create policy "Owners manage fund accounts" on public.fund_accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index fund_accounts_user_fund_idx on public.fund_accounts(user_id, fund_id);
