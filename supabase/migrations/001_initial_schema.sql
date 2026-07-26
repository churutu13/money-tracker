-- Denaro · schema iniziale
-- Importi monetari: sempre bigint in unità minime (centesimi).
-- Eseguire questo file nel SQL Editor di Supabase, poi ../seed.sql.

create extension if not exists "pgcrypto";

create type public.currency_code as enum ('EUR', 'CHF');
create type public.account_type as enum ('checking', 'cash', 'savings', 'investment', 'credit_card', 'tax');
create type public.transaction_type as enum ('income', 'expense', 'transfer', 'refund_received', 'refund_paid', 'allocation', 'disinvestment', 'investment', 'credit_card_payment', 'balance_adjustment');
create type public.budget_direction as enum ('income', 'expense');
create type public.budget_status as enum ('planned', 'due', 'paid', 'postponed', 'cancelled', 'partial');
create type public.frequency_type as enum ('once', 'monthly', 'weekly', 'yearly', 'custom');
create type public.tax_status as enum ('to_allocate', 'partial', 'allocated', 'used', 'closed');
create type public.receivable_status as enum ('active', 'partial', 'settled', 'late', 'cancelled');
create type public.payable_status as enum ('active', 'partial', 'settled', 'late', 'cancelled');
create type public.bucket_kind as enum ('tax', 'emergency', 'home', 'car', 'savings', 'investment', 'free', 'custom');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'it-IT',
  timezone text not null default 'Europe/Rome',
  seeded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type public.account_type not null,
  currency public.currency_code not null,
  current_balance bigint not null default 0,
  initial_balance bigint not null default 0,
  include_in_liquidity boolean not null default true,
  icon text,
  notes text,
  sort_order integer not null default 0,
  last_reconciled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.account_balance_adjustments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete restrict,
  previous_balance bigint not null,
  new_balance bigint not null,
  difference bigint generated always as (new_balance - previous_balance) stored,
  note text,
  adjusted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references public.categories(id) on delete set null,
  icon text,
  color text,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, parent_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#64748b',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.budget_months (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  month date not null check (month = date_trunc('month', month)::date),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, month)
);

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  initial_amount bigint not null check (initial_amount > 0),
  installment_amount bigint not null check (installment_amount > 0),
  total_installments integer not null check (total_installments > 0),
  paid_installments integer not null default 0 check (paid_installments >= 0 and paid_installments <= total_installments),
  first_due_date date not null,
  payment_day integer check (payment_day between 1 and 31),
  expected_end_date date,
  currency public.currency_code not null,
  account_id uuid references public.accounts(id) on delete set null,
  creditor text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  amount bigint not null check (amount >= 0),
  currency public.currency_code not null,
  payment_day integer check (payment_day between 1 and 31),
  frequency public.frequency_type not null default 'monthly',
  custom_interval_days integer check (custom_interval_days is null or custom_interval_days > 0),
  account_id uuid references public.accounts(id) on delete set null,
  category_id uuid references public.categories(id) on delete set null,
  start_date date not null,
  end_date date,
  next_due_date date,
  is_estimate boolean not null default false,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create table public.budget_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_month_id uuid references public.budget_months(id) on delete cascade,
  name text not null,
  amount bigint not null check (amount >= 0),
  currency public.currency_code not null,
  category_id uuid references public.categories(id) on delete set null,
  subcategory_id uuid references public.categories(id) on delete set null,
  expected_date date,
  paid_date date,
  account_id uuid references public.accounts(id) on delete set null,
  credit_card_id uuid,
  direction public.budget_direction not null,
  frequency public.frequency_type not null default 'once',
  status public.budget_status not null default 'planned',
  notes text,
  end_date date,
  installment_plan_id uuid references public.installment_plans(id) on delete set null,
  recurring_item_id uuid references public.recurring_items(id) on delete set null,
  rollover boolean not null default false,
  is_estimate boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index budget_recurring_occurrence_unique
  on public.budget_items(user_id, recurring_item_id, expected_date)
  where recurring_item_id is not null;

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  amount bigint not null check (amount > 0),
  currency public.currency_code not null,
  transaction_date date not null,
  type public.transaction_type not null,
  category_id uuid references public.categories(id) on delete set null,
  source_account_id uuid references public.accounts(id) on delete restrict,
  destination_account_id uuid references public.accounts(id) on delete restrict,
  credit_card_id uuid,
  person text,
  notes text,
  budget_item_id uuid references public.budget_items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (type = 'transfer' and source_account_id is not null and destination_account_id is not null and source_account_id <> destination_account_id)
    or type <> 'transfer'
  )
);

create table public.transaction_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references public.transactions(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (transaction_id, tag_id)
);

create table public.budget_item_tags (
  user_id uuid not null references auth.users(id) on delete cascade,
  budget_item_id uuid not null references public.budget_items(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (budget_item_id, tag_id)
);

create table public.installment_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  installment_number integer not null check (installment_number > 0),
  amount bigint not null check (amount > 0),
  due_date date not null,
  paid_date date,
  transaction_id uuid references public.transactions(id) on delete set null,
  status public.budget_status not null default 'due',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (plan_id, installment_number)
);

create table public.credit_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  statement_account_id uuid references public.accounts(id) on delete set null,
  statement_day integer check (statement_day between 1 and 31),
  payment_day integer check (payment_day between 1 and 31),
  credit_limit bigint check (credit_limit is null or credit_limit > 0),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un conto di tipo carta riceve automaticamente il relativo profilo carta.
-- Usiamo lo stesso UUID per rendere il collegamento browser/database inequivocabile.
create or replace function public.ensure_credit_card_profile()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.type = 'credit_card' then
    insert into public.credit_cards(id, user_id, account_id)
    values(new.id, new.user_id, new.id)
    on conflict (account_id) do nothing;
  end if;
  return new;
end;
$$;
create trigger ensure_credit_card_profile_after_write
  after insert or update of type on public.accounts
  for each row execute function public.ensure_credit_card_profile();

alter table public.transactions
  add constraint transactions_credit_card_fk foreign key (credit_card_id) references public.credit_cards(id) on delete set null;
alter table public.budget_items
  add constraint budget_items_credit_card_fk foreign key (credit_card_id) references public.credit_cards(id) on delete set null;

create table public.credit_card_cycles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  credit_card_id uuid not null references public.credit_cards(id) on delete cascade,
  cycle_start date not null,
  cycle_end date not null,
  statement_amount bigint not null default 0 check (statement_amount >= 0),
  pending_amount bigint not null default 0 check (pending_amount >= 0),
  payment_due_date date,
  paid_at timestamptz,
  payment_transaction_id uuid references public.transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (credit_card_id, cycle_start),
  check (cycle_end >= cycle_start)
);

create table public.tax_funds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  reference_period text not null check (reference_period ~ '^\d{4}-\d{2}$'),
  expected_amount bigint not null check (expected_amount >= 0),
  allocated_amount bigint not null default 0 check (allocated_amount >= 0 and allocated_amount <= expected_amount),
  currency public.currency_code not null,
  account_id uuid references public.accounts(id) on delete set null,
  allocation_date date,
  status public.tax_status not null default 'to_allocate',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.receivables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  person text not null,
  description text not null,
  original_amount bigint not null check (original_amount > 0),
  received_amount bigint not null default 0 check (received_amount >= 0 and received_amount <= original_amount),
  currency public.currency_code not null,
  repayment_method text,
  total_installments integer check (total_installments is null or total_installments > 0),
  received_installments integer not null default 0 check (received_installments >= 0),
  start_date date,
  next_due_date date,
  status public.receivable_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_installments is null or received_installments <= total_installments)
);

create table public.receivable_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receivable_id uuid not null references public.receivables(id) on delete cascade,
  amount bigint not null check (amount > 0),
  payment_date date not null,
  account_id uuid not null references public.accounts(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.payables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  creditor text not null,
  description text not null,
  original_amount bigint not null check (original_amount > 0),
  paid_amount bigint not null default 0 check (paid_amount >= 0 and paid_amount <= original_amount),
  currency public.currency_code not null,
  total_installments integer check (total_installments is null or total_installments > 0),
  paid_installments integer not null default 0 check (paid_installments >= 0),
  next_due_date date,
  status public.payable_status not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (total_installments is null or paid_installments <= total_installments)
);

create table public.payable_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  payable_id uuid not null references public.payables(id) on delete cascade,
  amount bigint not null check (amount > 0),
  payment_date date not null,
  account_id uuid not null references public.accounts(id) on delete restrict,
  transaction_id uuid references public.transactions(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.savings_buckets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind public.bucket_kind not null default 'custom',
  color text not null default '#64748b',
  currency public.currency_code not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, currency)
);

create table public.bucket_allocations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  bucket_id uuid not null references public.savings_buckets(id) on delete cascade,
  account_id uuid not null references public.accounts(id) on delete cascade,
  amount bigint not null check (amount >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, account_id)
);

-- Indici delle query principali
create index accounts_user_currency_idx on public.accounts(user_id, currency);
create index transactions_user_date_idx on public.transactions(user_id, transaction_date desc);
create index transactions_source_idx on public.transactions(source_account_id);
create index transactions_destination_idx on public.transactions(destination_account_id);
create index budget_items_user_date_idx on public.budget_items(user_id, expected_date);
create index recurring_items_user_active_idx on public.recurring_items(user_id, active);
create index tax_funds_user_currency_idx on public.tax_funds(user_id, currency, status);
create index receivables_user_status_idx on public.receivables(user_id, status);
create index payables_user_status_idx on public.payables(user_id, status);
create index bucket_allocations_account_idx on public.bucket_allocations(account_id);

-- updated_at uniforme
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'profiles','accounts','account_balance_adjustments','categories','tags','budget_months',
    'installment_plans','recurring_items','budget_items','transactions','transaction_tags',
    'budget_item_tags','installment_payments','credit_cards','credit_card_cycles','tax_funds',
    'receivables','receivable_payments','payables','payable_payments','savings_buckets','bucket_allocations'
  ]
  loop
    execute format('create trigger set_%I_updated_at before update on public.%I for each row execute function public.set_updated_at()', table_name, table_name);
  end loop;
end $$;

-- Profilo creato assieme all'utente Auth
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row Level Security: ogni tabella è privata per utente
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select using (id = auth.uid());
create policy profiles_update on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts','account_balance_adjustments','categories','tags','budget_months','installment_plans',
    'recurring_items','budget_items','transactions','transaction_tags','budget_item_tags',
    'installment_payments','credit_cards','credit_card_cycles','tax_funds','receivables',
    'receivable_payments','payables','payable_payments','savings_buckets','bucket_allocations'
  ]
  loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy %I_select on public.%I for select using (user_id = auth.uid())', table_name, table_name);
    execute format('create policy %I_insert on public.%I for insert with check (user_id = auth.uid())', table_name, table_name);
    execute format('create policy %I_update on public.%I for update using (user_id = auth.uid()) with check (user_id = auth.uid())', table_name, table_name);
    execute format('create policy %I_delete on public.%I for delete using (user_id = auth.uid())', table_name, table_name);
  end loop;
end $$;

-- Imposta user_id lato database per gli insert dal browser.
create or replace function public.set_owner()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;
  new.user_id = auth.uid();
  return new;
end;
$$;

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'accounts','account_balance_adjustments','categories','tags','budget_months','installment_plans',
    'recurring_items','budget_items','transactions','transaction_tags','budget_item_tags',
    'installment_payments','credit_cards','credit_card_cycles','tax_funds','receivables',
    'receivable_payments','payables','payable_payments','savings_buckets','bucket_allocations'
  ]
  loop
    execute format('create trigger set_%I_owner before insert on public.%I for each row execute function public.set_owner()', table_name, table_name);
  end loop;
end $$;

-- Validazione proprietà e valuta dei conti
create or replace function public.assert_account(p_account uuid, p_currency public.currency_code)
returns void language plpgsql security invoker set search_path = public as $$
declare found_currency public.currency_code;
begin
  if p_account is null then return; end if;
  select currency into found_currency from public.accounts where id = p_account and user_id = auth.uid();
  if not found then raise exception 'Account not found or not owned by user'; end if;
  if found_currency <> p_currency then raise exception 'Account currency mismatch'; end if;
end;
$$;

-- Movimento e aggiornamento saldi in una singola transazione SQL
create or replace function public.record_transaction(payload jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  tx_id uuid := gen_random_uuid();
  tx_type public.transaction_type := (payload ->> 'type')::public.transaction_type;
  tx_currency public.currency_code := (payload ->> 'currency')::public.currency_code;
  tx_amount bigint := (payload ->> 'amount')::bigint;
  source_id uuid := nullif(payload ->> 'source_account_id', '')::uuid;
  destination_id uuid := nullif(payload ->> 'destination_account_id', '')::uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if tx_amount <= 0 then raise exception 'Amount must be positive'; end if;
  perform public.assert_account(source_id, tx_currency);
  perform public.assert_account(destination_id, tx_currency);

  if tx_type in ('expense','refund_paid') then
    if source_id is null then raise exception 'Source account required'; end if;
    update public.accounts set current_balance = current_balance - tx_amount where id = source_id;
  elsif tx_type in ('income','refund_received') then
    if destination_id is null then raise exception 'Destination account required'; end if;
    update public.accounts set current_balance = current_balance + tx_amount where id = destination_id;
  elsif tx_type in ('transfer','allocation','investment','disinvestment','credit_card_payment') then
    if source_id is not null then
      update public.accounts set current_balance = current_balance - tx_amount where id = source_id;
    end if;
    if destination_id is not null then
      update public.accounts set current_balance = current_balance + tx_amount where id = destination_id;
    end if;
    if source_id is null and destination_id is null then raise exception 'At least one account required'; end if;
  end if;

  insert into public.transactions(
    id, user_id, description, amount, currency, transaction_date, type, category_id,
    source_account_id, destination_account_id, credit_card_id, person, notes, budget_item_id
  ) values (
    tx_id, auth.uid(), payload ->> 'description', tx_amount, tx_currency,
    coalesce((payload ->> 'transaction_date')::date, current_date), tx_type,
    nullif(payload ->> 'category_id', '')::uuid, source_id, destination_id,
    nullif(payload ->> 'credit_card_id', '')::uuid, nullif(payload ->> 'person', ''),
    nullif(payload ->> 'notes', ''), nullif(payload ->> 'budget_item_id', '')::uuid
  );
  return tx_id;
end;
$$;

create or replace function public.reverse_transaction_balances(tx public.transactions)
returns void language plpgsql security invoker set search_path = public as $$
begin
  if tx.type in ('expense','refund_paid') and tx.source_account_id is not null then
    update public.accounts set current_balance = current_balance + tx.amount where id = tx.source_account_id;
  elsif tx.type in ('income','refund_received') and tx.destination_account_id is not null then
    update public.accounts set current_balance = current_balance - tx.amount where id = tx.destination_account_id;
  elsif tx.type in ('transfer','allocation','investment','disinvestment','credit_card_payment') then
    if tx.source_account_id is not null then update public.accounts set current_balance = current_balance + tx.amount where id = tx.source_account_id; end if;
    if tx.destination_account_id is not null then update public.accounts set current_balance = current_balance - tx.amount where id = tx.destination_account_id; end if;
  end if;
end;
$$;

create or replace function public.delete_transaction(transaction_id uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare tx public.transactions;
begin
  select * into tx from public.transactions where id = transaction_id and user_id = auth.uid() for update;
  if not found then raise exception 'Transaction not found'; end if;
  perform public.reverse_transaction_balances(tx);
  delete from public.transactions where id = transaction_id;
end;
$$;

create or replace function public.update_transaction(transaction_id uuid, payload jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare tx public.transactions;
declare new_id uuid;
begin
  select * into tx from public.transactions where id = transaction_id and user_id = auth.uid() for update;
  if not found then raise exception 'Transaction not found'; end if;
  perform public.reverse_transaction_balances(tx);
  delete from public.transactions where id = transaction_id;
  new_id := public.record_transaction(payload);
  return new_id;
exception when others then
  raise;
end;
$$;

create or replace function public.reconcile_account(account_id uuid, new_balance bigint, adjustment_note text default null)
returns uuid language plpgsql security invoker set search_path = public as $$
declare old_balance bigint;
declare adjustment_id uuid := gen_random_uuid();
begin
  select current_balance into old_balance from public.accounts where id = account_id and user_id = auth.uid() for update;
  if not found then raise exception 'Account not found'; end if;
  insert into public.account_balance_adjustments(id, user_id, account_id, previous_balance, new_balance, note)
  values (adjustment_id, auth.uid(), account_id, old_balance, new_balance, adjustment_note);
  update public.accounts set current_balance = new_balance, last_reconciled_at = now() where id = account_id;
  return adjustment_id;
end;
$$;

create or replace function public.mark_budget_item_paid(item_id uuid, payment_account_id uuid, payment_date date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare item public.budget_items;
declare existing_tx uuid;
declare tx_id uuid;
begin
  select * into item from public.budget_items where id = item_id and user_id = auth.uid() for update;
  if not found then raise exception 'Budget item not found'; end if;
  select id into existing_tx from public.transactions where budget_item_id = item_id limit 1;
  if existing_tx is not null then
    update public.budget_items set status = 'paid', paid_date = payment_date, account_id = payment_account_id where id = item_id;
    return existing_tx;
  end if;
  tx_id := public.record_transaction(jsonb_build_object(
    'description', item.name, 'amount', item.amount, 'currency', item.currency,
    'transaction_date', payment_date,
    'type', case when item.direction = 'expense' then 'expense' else 'income' end,
    'source_account_id', case when item.direction = 'expense' then payment_account_id else null end,
    'destination_account_id', case when item.direction = 'income' then payment_account_id else null end,
    'credit_card_id', item.credit_card_id, 'budget_item_id', item.id, 'notes', item.notes
  ));
  update public.budget_items set status = 'paid', paid_date = payment_date, account_id = payment_account_id where id = item_id;
  return tx_id;
end;
$$;

create or replace function public.duplicate_budget_month(source_month date, target_month date)
returns integer language plpgsql security invoker set search_path = public as $$
declare copied integer;
begin
  if source_month <> date_trunc('month', source_month)::date or target_month <> date_trunc('month', target_month)::date then
    raise exception 'Month values must be the first day of a month';
  end if;
  insert into public.budget_months(user_id, month) values(auth.uid(), target_month) on conflict do nothing;
  insert into public.budget_items(
    user_id, budget_month_id, name, amount, currency, category_id, subcategory_id,
    expected_date, account_id, credit_card_id, direction, frequency, status, notes,
    end_date, installment_plan_id, recurring_item_id, rollover, is_estimate
  )
  select auth.uid(), (select id from public.budget_months where user_id = auth.uid() and month = target_month),
    b.name, b.amount, b.currency, b.category_id, b.subcategory_id,
    target_month + greatest(0, least(extract(day from b.expected_date)::int - 1, 27)),
    b.account_id, b.credit_card_id, b.direction, b.frequency, 'planned', b.notes,
    b.end_date, b.installment_plan_id, b.recurring_item_id, b.rollover, b.is_estimate
  from public.budget_items b
  where b.user_id = auth.uid()
    and b.expected_date >= source_month
    and b.expected_date < source_month + interval '1 month'
    and not exists (
      select 1 from public.budget_items target
      where target.user_id = auth.uid()
        and target.expected_date >= target_month
        and target.expected_date < target_month + interval '1 month'
        and target.name = b.name and target.amount = b.amount and target.currency = b.currency
    );
  get diagnostics copied = row_count;
  return copied;
end;
$$;

create or replace function public.ensure_recurring_budget(target_month date default date_trunc('month', current_date)::date)
returns integer language plpgsql security invoker set search_path = public as $$
declare generated integer;
begin
  insert into public.budget_months(user_id, month) values(auth.uid(), target_month) on conflict do nothing;
  insert into public.budget_items(
    user_id, budget_month_id, name, amount, currency, category_id, expected_date,
    account_id, direction, frequency, status, notes, recurring_item_id, is_estimate
  )
  select auth.uid(), (select id from public.budget_months where user_id = auth.uid() and month = target_month),
    r.name, r.amount, r.currency, r.category_id,
    target_month + least(coalesce(r.payment_day, extract(day from r.start_date)::int) - 1, 27),
    r.account_id, 'expense', r.frequency, 'planned', r.notes, r.id, r.is_estimate
  from public.recurring_items r
  where r.user_id = auth.uid() and r.active
    and r.start_date < target_month + interval '1 month'
    and (r.end_date is null or r.end_date >= target_month)
  on conflict (user_id, recurring_item_id, expected_date) where recurring_item_id is not null do nothing;
  get diagnostics generated = row_count;
  return generated;
end;
$$;

create or replace function public.record_receivable_payment(
  receivable_id uuid, payment_amount bigint, destination_account uuid, payment_date date
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare item public.receivables;
declare tx_id uuid;
declare payment_id uuid := gen_random_uuid();
begin
  select * into item from public.receivables where id = receivable_id and user_id = auth.uid() for update;
  if not found then raise exception 'Receivable not found'; end if;
  if payment_amount <= 0 or item.received_amount + payment_amount > item.original_amount then raise exception 'Invalid payment amount'; end if;
  tx_id := public.record_transaction(jsonb_build_object(
    'description', 'Rimborso ' || item.person || ' · ' || item.description,
    'amount', payment_amount, 'currency', item.currency, 'transaction_date', payment_date,
    'type', 'refund_received', 'destination_account_id', destination_account, 'person', item.person
  ));
  insert into public.receivable_payments(id, user_id, receivable_id, amount, payment_date, account_id, transaction_id)
  values(payment_id, auth.uid(), receivable_id, payment_amount, payment_date, destination_account, tx_id);
  update public.receivables
  set received_amount = received_amount + payment_amount,
      received_installments = received_installments + 1,
      status = case when received_amount + payment_amount >= original_amount then 'settled'::public.receivable_status else 'partial'::public.receivable_status end
  where id = receivable_id;
  return payment_id;
end;
$$;

create or replace function public.validate_bucket_allocation()
returns trigger language plpgsql security invoker set search_path = public as $$
declare account_balance bigint;
declare account_currency public.currency_code;
declare bucket_currency public.currency_code;
declare allocated_total bigint;
begin
  select current_balance, currency into account_balance, account_currency
  from public.accounts where id = new.account_id and user_id = auth.uid();
  select currency into bucket_currency from public.savings_buckets where id = new.bucket_id and user_id = auth.uid();
  if account_currency <> bucket_currency then raise exception 'Bucket and account currency mismatch'; end if;
  select coalesce(sum(amount), 0) into allocated_total
  from public.bucket_allocations
  where account_id = new.account_id and id <> coalesce(new.id, gen_random_uuid());
  if allocated_total + new.amount > greatest(account_balance, 0) then
    raise exception 'Bucket allocations exceed account balance';
  end if;
  return new;
end;
$$;
create trigger validate_bucket_allocation_before_write
  before insert or update on public.bucket_allocations
  for each row execute function public.validate_bucket_allocation();

create or replace function public.create_savings_bucket(
  bucket_name text, bucket_kind public.bucket_kind, bucket_color text, bucket_currency public.currency_code,
  allocation_account_id uuid default null, allocation_amount bigint default 0
)
returns uuid language plpgsql security invoker set search_path = public as $$
declare bucket_id uuid := gen_random_uuid();
begin
  insert into public.savings_buckets(id, user_id, name, kind, color, currency)
  values(bucket_id, auth.uid(), bucket_name, bucket_kind, bucket_color, bucket_currency);
  if allocation_account_id is not null and allocation_amount > 0 then
    insert into public.bucket_allocations(user_id, bucket_id, account_id, amount)
    values(auth.uid(), bucket_id, allocation_account_id, allocation_amount);
  end if;
  return bucket_id;
end;
$$;

grant execute on function public.record_transaction(jsonb) to authenticated;
grant execute on function public.delete_transaction(uuid) to authenticated;
grant execute on function public.update_transaction(uuid, jsonb) to authenticated;
grant execute on function public.reconcile_account(uuid, bigint, text) to authenticated;
grant execute on function public.mark_budget_item_paid(uuid, uuid, date) to authenticated;
grant execute on function public.duplicate_budget_month(date, date) to authenticated;
grant execute on function public.ensure_recurring_budget(date) to authenticated;
grant execute on function public.record_receivable_payment(uuid, bigint, uuid, date) to authenticated;
grant execute on function public.create_savings_bucket(text, public.bucket_kind, text, public.currency_code, uuid, bigint) to authenticated;
