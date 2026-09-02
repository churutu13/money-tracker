create extension if not exists "pgcrypto";

create type public.fund_kind as enum ('available', 'savings', 'tax', 'emergency', 'custom');
create type public.transaction_type as enum ('income', 'expense', 'transfer');
create type public.expense_kind as enum ('fixed', 'variable');
create type public.tax_strategy as enum ('fixed', 'percentage', 'manual');

create table public.funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  balance numeric(14,2) not null default 0,
  kind public.fund_kind not null default 'custom',
  created_at timestamptz not null default now()
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  fund_id uuid not null references public.funds(id) on delete restrict,
  destination_fund_id uuid references public.funds(id) on delete set null,
  name text not null,
  amount numeric(14,2) not null check (amount > 0),
  type public.transaction_type not null,
  date date not null,
  category text,
  notes text,
  expense_kind public.expense_kind,
  recurrence jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.salary_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  usable_monthly_income numeric(14,2) not null,
  payday smallint not null check (payday between 1 and 31),
  gross_salary numeric(14,2),
  overtime_gross_rate numeric(10,2),
  average_overtime_hours numeric(8,2) not null default 0,
  overtime_net_ratio numeric(5,4) not null default .62,
  thirteenth_salary_months smallint[] not null default '{}',
  tax_strategy public.tax_strategy not null default 'manual',
  tax_value numeric(12,2) not null default 0,
  monthly_overtime jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table public.financial_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  original_amount numeric(14,2) not null,
  monthly_payment numeric(14,2) not null,
  number_of_payments integer not null,
  payments_made integer not null default 0,
  start_date date not null,
  balloon_payment numeric(14,2),
  apr numeric(7,3),
  target_payoff_date date,
  linked_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  currency text not null default 'EUR',
  locale text not null default 'en-IE',
  safety_buffer numeric(14,2) not null default 500,
  monthly_lifestyle_budget numeric(14,2) not null default 600,
  expected_tax_bill numeric(14,2) not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.funds enable row level security;
alter table public.transactions enable row level security;
alter table public.salary_profiles enable row level security;
alter table public.financial_plans enable row level security;
alter table public.user_settings enable row level security;

create policy "Owners manage funds" on public.funds for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners manage transactions" on public.transactions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners manage salary profiles" on public.salary_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners manage plans" on public.financial_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "Owners manage settings" on public.user_settings for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index transactions_user_date_idx on public.transactions(user_id, date desc);
create index funds_user_idx on public.funds(user_id);
