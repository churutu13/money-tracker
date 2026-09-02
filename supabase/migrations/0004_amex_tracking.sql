alter table public.transactions
  add column if not exists payment_method text check (payment_method in ('bank', 'amex')),
  add column if not exists amex_reserved boolean not null default false;

alter table public.funds
  add column if not exists cycle_entries jsonb not null default '{}';
