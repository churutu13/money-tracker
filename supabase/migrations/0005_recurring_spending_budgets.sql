alter table public.transactions
  add column if not exists recurring_budget_id uuid references public.transactions(id) on delete set null;

create index if not exists transactions_recurring_budget_idx
  on public.transactions(recurring_budget_id);
