# ACME Bank v2

A digital banking **simulation** with the look and behavior of a real product. All external integrations are simulated, and no real money, card numbers or KYC are involved.

> Source spec: `../specs/PRD.md`. This repository is a **security-aware scaffold**. Every source file is a placeholder.
> Implement the features following the task recipes in [`AGENTS.md`](./AGENTS.md) and `skills/`.

## Product overview (from the PRD)

- **UI:** English only. Navy blue and orange theme. Side menu on desktop, bottom navigation on mobile.
- **Pages:** account opening, overview, accounts and transactions, transfers, beneficiaries, scheduled payments, cards, statements, support, and a bank staff panel.
- **Customer actions:** open a simulated account, check balances, transfer money, schedule payments, block a card, and change limits. Fees are shown before confirmation.
- **Ledger:** debit/credit entry history, with amounts stored in **cents**.
- **Statements:** CSV and PDF.
- **Simulations:** purchases, deposits, insufficient funds, and transfers that stay pending before completing.
- **Roles:** customer, support, administrator. Navigation adapts to the role.
- **Demo data:** six customers and two months of transactions. A simulation area lets you choose scenarios, advance time, view events and reset data. Results persist across reloads.
- **Cross-cutting:** login, password recovery, profile, settings, search, filters, loading states and error messages.

## Stack

| Layer | Technology |
|-------|------------|
| Web + API | Next.js (App Router), React, TypeScript |
| UI | Tailwind CSS, shadcn/ui |
| Package manager | pnpm |
| Database | Supabase PostgreSQL |
| Auth | Supabase Auth (email + password, password recovery) |
| Files | Supabase Storage (statements) |
| Realtime | Supabase Realtime |
| Hosting | Vercel (web + API) |

## Project layout

```
src/app/(auth)/      login, forgot/reset password, open-account
src/app/(app)/       customer screens
src/app/(staff)/     staff panel + simulation control
src/app/api/         route handlers deployed to Vercel
src/components/      UI components (shadcn/ui)
src/services/        domain services
src/lib/supabase/    Supabase clients (browser / server)
supabase/            migrations, seed, local config
skills/              SD Elements security task recipes (one per countermeasure)
```

## Run locally

1. Install the tools: Node.js 22+, pnpm, and the Supabase CLI.
2. Run `pnpm install`.
3. Run `cp .env.example .env.local` and fill in the values.
4. Run `pnpm supabase start`, then `pnpm db:reset` to apply the migrations and seed data.
5. Run `pnpm dev`.

## Deploy to Vercel

1. Create a Supabase project, choosing a region that meets the data-localization requirement (see `skills/infrastructure/T2170-*`). Apply the migrations with `supabase db push`.
2. Import the repository in Vercel and set the environment variables from `.env.example`. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only.
3. Deploy. Both the web app and the API routes are served by the same Vercel project.

## Security

The SD Elements project is **ACME Bank v2** (ID 31). See [`AGENTS.md`](./AGENTS.md) for the 51 file-tracked countermeasures. There are 6 more organizational countermeasures, tracked only in SD Elements.
