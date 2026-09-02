# Flow

Flow is a calm, local-first personal cash-flow planner built with Next.js 16, TypeScript, Tailwind CSS, Supabase, Recharts, and Lucide. It keeps reserved tax money outside spendable cash, supports manual 24-cycle forecasts, and makes transaction entry fast enough to use every day.

## What is implemented

- Home: a manual payday-to-payday Income, Fixed, and Lifestyle planner; Available Cash before and after unreserved Amex purchases; upcoming payments; and Savings and Tax Reserve at the bottom.
- Transactions: chronological timeline, search, filters, add/edit/delete/duplicate, transfers between funds, complete recurrence controls, categories, notes, and fund selection. Posted one-time transactions update fund balances and reverse correctly when edited or deleted.
- Forecast: a fully manual 24-pay-cycle balance chart with editable Salary, Recurring, and Lifestyle values plus per-cycle overrides.
- Amex: statement cycles from the 27th to the 26th, debit date on the following 10th, and a per-purchase set-aside checklist.
- Settings: editable funds, a fixed-expense manager, multiple salary profiles, monthly overtime with manual usable override, Tax Reserve strategy, lifestyle wallet, installation help, and JSON backup import/export.
- PWA: installable manifest, standalone metadata, adaptive theme colors, service-worker caching, and mobile bottom-sheet/navigation behavior.
- Persistence: immediate local-first storage with a typed Supabase boundary and row-level-security schema for authenticated sync.

## Local setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. Demo data is loaded the first time and then saved in `localStorage`. Use Settings → Restore demo data to reset it.

## Supabase configuration

1. Create a Supabase project.
2. Run `supabase/migrations/0001_initial_schema.sql` in the Supabase SQL editor, or copy it into a Supabase CLI migration.
3. Copy `.env.example` to `.env.local` and add the project URL and anon key.
4. Add an authentication UI/provider appropriate to your deployment, then hydrate the app store with `loadWorkspace` from `lib/supabase/repository.ts`.

The migrations create funds, transactions, salary profiles, and settings. Active tables have row-level security and owner-only policies. Recurrence lives in typed JSON so monthly, weekly, yearly, and future custom rules can evolve without repeated migrations.

The current UI remains local-first by design: it works without an account and no financial data leaves the browser. `lib/supabase/repository.ts` is the production sync seam. A parsed Quick Add object can call the same `addTransaction` / `upsertTransaction` path as the form, which is why natural-language entry can be added later without changing the core transaction engine.

## Forecast rules

- Forecast starts from zero and never imports real balances, salaries, recurring expenses, or other app data.
- Salary, Recurring, and Lifestyle defaults are manual and can be overridden for any pay cycle.
- Expenses linked to a recurring spending budget draw down that budget without changing Available Cash. Their Amex set-aside status remains manual; unreserved budget expenses stay excluded from the effective Available Cash deduction because their money was already allocated.

These are planning estimates, not tax or lending advice.

## Production and Vercel

1. Push the repository to GitHub/GitLab/Bitbucket.
2. Import it in Vercel and keep the detected Next.js preset.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Production, Preview, and Development environments.
4. Deploy, then add the Vercel domain to Supabase Auth URL configuration if authentication is enabled.
5. Test Add to Home Screen on iOS over HTTPS. Service workers require HTTPS outside localhost.

Run the release checks before deployment:

```bash
npm run lint
npm run build
```

## Project structure

```text
app/                    App Router pages and global design system
components/             Shell, store/provider, and transaction sheet
lib/engine.ts           Recurrence, safe-to-spend, and forecast calculations
lib/types.ts            Domain types
lib/supabase/           Optional production persistence boundary
public/                 PWA manifest, icon, and service worker
supabase/migrations/    Database schema and RLS policies
```
