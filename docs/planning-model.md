# Flow planning model

## Existing architecture

Flow is a Next.js 16 App Router PWA. Its UI is rendered inside a persistent client-side `AppShell`; application data is managed by `AppProvider` and stored locally under a versioned `localStorage` key. `lib/types.ts` defines funds, transactions, recurrence, salary, settings, and Frontax data. `lib/engine.ts`, `lib/frontax.ts`, and `lib/overtime.ts` hold pure calculations. Supabase is an optional typed synchronization boundary rather than the active UI store.

The planning module is additive. Pure planning types and calculations live under `lib/planning/`, planning scenarios use a separate `flow.planning.v1` browser key, and the adapter reads existing Flow data without changing transactions, balances, recurrence, Frontax, or the existing manual forecast.

## Workbook mapping

`Financial_Projection_2026_2031_Updated.xlsx` contains four sheets: Assumptions, Core Projection, House Scenarios, and Sources. The application model reproduces its monthly income, expense step-downs, tax reserve, lifestyle allowance, Senior and cohabitation scenarios, Findomestic payoff, Tesla partial repayment, mortgage payment, and home-equity calculations as month-by-month TypeScript logic.

The workbook uses €15,500 at 31 December 2026 as the opening projection anchor. It adds €2,000 of 13th-salary savings each December. Recurring expenses are inclusive of their stated end month. Findomestic is paid monthly through December 2027 and then receives the modeled €11,000 payoff. Tesla's €10,000 partial repayment occurs in December 2028 and the estimated €212 payment begins in January 2029.

The label “Tax reserve through Nov-2027” conflicts with the formulas, which deduct €850 in all twelve months of 2027. The engine follows the formulas and changes to €650 in January 2028. This is recorded in the assumption note instead of being hidden.

House purchases occur at the start of January 2029 using the prior month’s closing liquidity. Mortgage payments begin in the purchase month. Couple scenarios apply the editable ownership share to down payment, purchase costs, mortgage payments, and home equity. Property appreciation defaults to 0%. A 90% LTV scenario is explicitly hypothetical and is not presented as a Consap or lender guarantee.

## Validation

`npm run test:planning` compiles the isolated planning modules and runs boundary, mortgage, liquidity, scenario-comparison, and cached-workbook validation tests. Cached values come from the supplied workbook and cover Base, Senior, Cohabitation, Senior + Cohabitation, Tesla repayment, and representative 80%/90% house cases for both solo and joint purchases.
