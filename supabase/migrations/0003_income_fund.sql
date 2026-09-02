alter type public.fund_kind add value if not exists 'income';

alter table public.funds
  add column if not exists monthly_balances jsonb not null default '{}';
