# ACME Bank

A digital bank **simulation** that looks and behaves like a real product: open an account, check
balances, move money, schedule payments, control your card, download statements, talk to support,
and run the bank from a staff panel. All external integrations (card network, payment rails,
identity/email verification) are simulated. No real money, cards or KYC are involved.

Built with Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui (Radix), pnpm,
and Supabase (PostgreSQL, Auth, Storage, Realtime). Web and API deploy together to Vercel.

## Features

| Area | What you can do |
|------|-----------------|
| Account opening | Three-step simulated onboarding with a separate consent step (optional consents off by default). Starts with a $250 simulated deposit |
| Overview | Total balance, accounts, money in/out this month, spending by category, recent activity, pending transfers, upcoming payments. Live updates |
| Accounts & transactions | Account switcher, full account details, debit/credit ledger (integer cents) with search, type/category/date filters and pagination. Open extra checking/savings accounts |
| Transfers | Between own accounts (free) or to beneficiaries (0.2%, min $1.50, max $25). **Fee and total shown before confirmation.** Insufficient funds is blocked. Transfers stay **pending** until they settle. History with status filter |
| Beneficiaries | Search, add (password re-confirmation), remove |
| Scheduled payments | One-off or monthly, fee reviewed before confirming, cancel, history (executed / failed / cancelled) |
| Cards | Block instantly, unblock (password), change the daily limit (raising needs password), today's usage, approved/declined authorizations |
| Statements | PDF and CSV per account and period, stored privately, downloaded through short-lived links |
| Support | Customers open requests and chat with support; staff work a queue |
| Profile & Settings | Correct personal data; change password; sign out other devices; turn optional consents on/off |
| Staff panel | Support + admin: aggregated dashboard, masked customer search, customer detail, record processing restrictions. Admin: card actions, role changes, audit log |
| Simulation (admin) | Run scenarios (purchases, deposits, payday, insufficient funds, pending transfers), advance the simulated clock (settles transfers, runs scheduled payments, payroll), view events, reset demo data |

Navigation adapts to the role: side menu on desktop, bottom navigation on mobile. The UI is in English;
amounts are USD, dates are shown in UTC.

## Demo data

`pnpm seed:demo` creates six fictional customers (`customer1@demo.acme-bank.example` …
`customer6@demo.acme-bank.example`), a support agent (`support@demo.acme-bank.example`) and an
administrator (`admin@demo.acme-bank.example`), all with the password you put in `DEMO_USER_PASSWORD`.
Each customer gets about two months of activity: payroll, card purchases, rent, savings top-ups,
utilities, upcoming scheduled payments, internal ACME beneficiaries, two pending transfers and support
tickets. The same SQL baseline is used by **Simulation > Reset**, so results stay deterministic.

## Project layout

```
src/app/(auth)/          login, forgot/reset password, open-account (+ server actions)
src/app/(app)/           customer screens and shared Support / Settings
src/app/(staff)/         staff dashboard, customer detail, audit log, simulation
src/app/api/             REST route handlers (Vercel Functions)
src/components/ui/       shadcn/ui-style primitives (button, card, dialog, switch, table, ...)
src/components/app/      app shell, navigation, ledger list, step-up dialog, realtime refresher
src/services/            domain services (accounts, transfers, cards, statements, support, staff, simulation, privacy, auth)
src/lib/                 authz, rate limiting, CSRF, crypto, env validation, money helpers, Supabase clients
src/proxy.ts             session refresh, route protection, CSP, CORS, CSRF cookie
supabase/migrations/     schema, functions, grants + RLS, audit, storage, product features
scripts/seed-demo.ts     demo users + baseline data
tests/                   unit tests + live database access-control tests
docs/security.md         platform security configuration (Supabase / Vercel)
skills/, AGENTS.md       SD Elements countermeasure recipes
```

## Run locally

Requirements: Node.js 22+, pnpm 10, Docker (for the local Supabase stack).

```bash
pnpm install
pnpm supabase start                    # starts Postgres, Auth, Storage, Realtime, Mailpit
cp .env.example .env.local             # then fill in the values (see below)
pnpm db:reset                          # applies migrations and seeds the demo data
pnpm dev                               # http://localhost:3000
```

Fill `.env.local` from `pnpm supabase status`:

| Variable | Value for local development |
|----------|------------------------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `ANON_KEY` from `supabase status` |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` |
| `SUPABASE_SERVICE_ROLE_KEY` | `SERVICE_ROLE_KEY` from `supabase status` (server only) |
| `APP_SIGNING_KEY`, `APP_ENCRYPTION_KEY` | `openssl rand -base64 32` (each) |
| `CRON_SECRET` | `openssl rand -base64 32` |
| `SIMULATION_ADMIN_ENABLED` | `true` to use the Simulation page locally |
| `DEMO_USER_PASSWORD` | Any password with 12+ characters, upper/lower case and a digit |

Password-reset emails are caught by Mailpit at http://127.0.0.1:54324.

Useful scripts: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:db` (needs the local stack +
seed), `pnpm build`, `pnpm audit`, `pnpm seed:demo`.

## API

All endpoints live in the same Vercel project as the web app, use the session cookie, and require the
`x-csrf-token` header (value of the `csrf_token` cookie) plus a same-origin `Origin` on mutations.

| Method & path | Who | Purpose |
|---------------|-----|---------|
| `GET /api/accounts[?accountId=…&text=…&direction=…&category=…&from=…&to=…&cursor=…]` | customer | Accounts with balances, or a paginated ledger search |
| `GET/POST /api/transfers` | customer | List; `{action:"quote"}` returns the fee, `{action:"confirm"}` executes |
| `GET/POST/PATCH /api/scheduled-payments` | customer | List, create, cancel |
| `GET/PATCH /api/cards/{id}` | customer (own), admin | Card details; block/unblock/limit (step-up rules apply) |
| `POST /api/statements`, `GET /api/statements/{id}` | customer | Generate; download via 60 s signed URL |
| `GET /api/staff/customers?q=` | support, admin | Masked customer search |
| `POST /api/staff/restrictions` | support, admin | Record a processing restriction |
| `GET/POST /api/simulation` | admin (+ flag) | Events; apply / advance / reset |
| `GET /api/jobs/settle` | Vercel Cron (`Authorization: Bearer $CRON_SECRET`) | Settle pending transfers, run due scheduled payments |
| `POST /api/auth/logout` | any | Sign out with `Clear-Site-Data` |

## Deploy to Vercel (web + API)

1. **Supabase project.** Create it in the region your data-localization decision requires (see
   `docs/security.md`, T2170). Link and push the schema:
   ```bash
   pnpm supabase link --project-ref <project-ref>
   pnpm supabase db push
   ```
2. **Supabase settings** (Dashboard): Authentication > Sign In: disable sign-ups, minimum password 12,
   leaked-password protection, CAPTCHA (Turnstile); URL Configuration: Site URL `https://<your-domain>`,
   redirect URL `https://<your-domain>/auth/confirm`; Email: custom SMTP and the recovery template from
   `supabase/templates/recovery.html`; API: expose only `public`. Full list in `docs/security.md`.
3. **Vercel project.** Import the repository (framework: Next.js, install `pnpm install --frozen-lockfile`).
   Add the environment variables from `.env.example` for **Production** (mark the server secrets
   as Sensitive), with `NEXT_PUBLIC_SITE_URL=https://<your-domain>` and the hosted Supabase URL and keys.
   Keep `SIMULATION_ADMIN_ENABLED=false` unless this is a demo deployment.
4. **Deploy.** Pages, Server Actions and `/api/*` route handlers are served by the same deployment.
   `vercel.json` sets function durations and the settlement cron (`/api/jobs/settle`; Vercel sends
   `CRON_SECRET` automatically). Optionally pin `"regions"` to match the Supabase region.
5. **Demo data (demo deployments only).** Run the seeder from your machine against the hosted project:
   `NEXT_PUBLIC_SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… DEMO_USER_PASSWORD=<unique> pnpm seed:demo`.
6. Turn on Vercel Firewall managed rules and rate-limit rules (T374) and a log drain (T349).

## Security

This repository follows the SD Elements project **ACME Bank v2** (ID 31). The task recipes are in
`skills/` and the contract in `AGENTS.md`. All 51 file-tracked countermeasures are addressed: 48 in
code and 3 infrastructure items documented in `docs/security.md`. The 6 PROCESS countermeasures
(T1386, T2348, T2128, CT1, CT2, T755) are tracked in SD Elements only. Countermeasure statuses in SD
Elements were **not** changed (that is done later by `apply-fixes-from-security-specs`).

| ID | Countermeasure | Where it is implemented |
|----|----------------|-------------------------|
| T2 | Secure password reset | `src/services/auth.service.ts` (generic response, per-email/IP limits, policy, revoke other sessions, notice), `src/app/(auth)/forgot-password`, `reset-password`, `src/app/auth/confirm/route.ts`, `supabase/templates/recovery.html`, `supabase/config.toml` (OTP expiry) |
| T70 | Login throttling | `src/services/auth.service.ts` (backoff after 5 / 3 for staff, per account + IP, audit), `supabase/migrations/0002_functions.sql` (`login_failure_*`) |
| T338 | Authn + authz everywhere, step-up | `src/proxy.ts`, `src/lib/page-auth.ts`, `src/lib/authz.ts`, `src/services/step-up.service.ts`, `src/components/app/step-up.tsx`, logout in `src/components/app/app-shell.tsx` |
| T20 | Session management | `src/lib/supabase/server.ts`, `src/proxy.ts` (httpOnly cookies, `getUser()`), sign-out before login, `setUserRole` revokes sessions, `supabase/config.toml` (rotation, 1 h JWT) |
| T1539 | Clear browser data on logout | `src/app/api/auth/logout/route.ts` (`Clear-Site-Data`), `src/components/logout-button.tsx` (closes Realtime), `next.config.ts` (`no-store`) |
| T184 | Authz on REST services | `src/lib/authz.ts` (deny-by-default matrix) used by every `src/app/api/**/route.ts` and server action |
| T17 | No client-only authz | Server layouts `src/app/(app)/layout.tsx`, `src/app/(staff)/layout.tsx`, `requirePageRole` per page, cosmetic nav `src/components/app/nav-config.ts` |
| T378 | Authorize every object | Ownership filters in `src/services/*`, RLS in `0003_security.sql` / `0006_banking_features.sql`, 404 for foreign ids, demo-only check in `simulation.service.ts` |
| T50 | Indirect file references | `src/app/api/statements/[statementId]/route.ts`, `src/services/statements.service.ts` (server-generated paths, 60 s signed URLs) |
| T38 | Bind variables | Query builder only, `escapeLike` in `src/services/accounts.service.ts`, no dynamic SQL in `supabase/migrations/*` |
| T19 | Least-privilege DB access | `0003_security.sql` (default deny, RPC-only money movement), `0006` grants, `src/lib/supabase/admin.ts` (service role confined) |
| T2598 | Query-level access control | Access matrix in `0003_security.sql`, staff functions in `0006` (masked, role re-checked), column grants |
| T2600 | Result set size | `PAGE_MAX` 50 in services, staff search ≥3 chars / 20 rows, statement 366 days / 10k rows, `max_rows` in `config.toml` |
| T1362 | API throttling | `src/lib/rate-limit.ts` + `rate_limit_hit()`; budgets applied in every action and route |
| T1365 | SSRF | `src/lib/outbound.ts` (allow-list); simulated integrations run in SQL (`0006` card network) with no outbound calls |
| T2139 | No info exposure via APIs | Named columns everywhere, zod-validated staff responses (`staff.service.ts`), `src/lib/errors.ts`, `src/lib/action.ts`, `src/app/error.tsx` |
| T536 | Message size limits | `src/lib/http.ts` (`readJson` 413), `next.config.ts` `bodySizeLimit: 100kb`, zod max lengths, DB `check` constraints |
| T35 | HTTP server settings | `maxDuration` per route, `vercel.json`, `poweredByHeader: false` |
| T36 | Escape untrusted data | React text rendering only, `react/no-danger` lint rule, `src/components/safe-link.tsx` |
| T37 | DOM XSS | `src/lib/safe-url.ts` (`safeNext`), DOM-sink lint rules in `eslint.config.mjs`, nonce CSP in `src/proxy.ts` |
| T1144 | SSTI | PDF built from React components with data as props (`statements.service.ts`); static email templates (`email.service.ts`) |
| T42 | No untrusted server-side selection | Scenario / format / status enums, bounded `days` (`simulation.service.ts`, `scenarios.ts`, `statements.service.ts`, SQL checks) |
| T29 | Anti-CSRF | Server Actions Origin check (`next.config.ts` `allowedOrigins`), `src/lib/csrf.ts` double-submit for routes, HMAC single-use transfer quotes (`transfers.service.ts`) |
| T257 | Secure CORS | `src/proxy.ts` exact-origin allow-list, `Vary: Origin` |
| T66 | Anti-framing + headers | `next.config.ts` (`X-Frame-Options`, HSTS, nosniff…), CSP `frame-ancestors 'none'` in `src/proxy.ts` |
| T1468 | Browser data at rest | Cookie sessions, in-memory Realtime token (`src/lib/supabase/client.ts`), no local/session storage anywhere |
| T151 | CSPRNG | `src/lib/ids.ts`, `private.random_digits()` (pgcrypto), `gen_random_uuid()`; `Math.random` banned by lint |
| T60 | Approved algorithms | `src/lib/crypto.ts` (HMAC-SHA-256, AES-256-GCM), weak-algorithm lint rules |
| T59 | Standard crypto libraries | `node:crypto`, WebCrypto, pgcrypto, Supabase Auth only; `no-restricted-imports` in `eslint.config.mjs` |
| T76 | No hardcoded passwords | `src/lib/env.ts` (validated, server-only), `.env.example` placeholders, `DEMO_USER_PASSWORD` from env in `scripts/seed-demo.ts`, gitleaks in CI |
| T2599 | Connection string pollution | `src/lib/env.public.ts` (fixed, validated URL), scenarios as rows in one DB |
| T21 | TLS in transit | HSTS, https/wss enforced in production (`env.public.ts`, `instrumentation.ts`), `upgrade-insecure-requests` |
| T156 | Certificate validation | `src/instrumentation.ts` guard, CI grep, lint rule against `rejectUnauthorized: false` |
| T558 | Authenticate components | `src/app/api/jobs/settle/route.ts` (`CRON_SECRET`, constant-time compare), service key server-only |
| T742 | Accuracy of personal data | `src/app/(app)/profile/*` (validated self-service edits), single `profiles` table, unique email |
| T604 | Consent withdrawal | `src/app/(app)/settings/*` (toggles), `privacy.service.ts`, `consents` + `consent_events` |
| T178 | Consent before collection | `src/app/(auth)/open-account/*` (separate consent step), `open_customer_account()` records consents before profile data |
| T754 | Restriction of processing | `privacy.service.ts` (`assertProcessingAllowed`), staff restriction form (`src/app/(staff)/staff/*`), Settings shows restrictions |
| T544 | Anonymize for secondary use | Fictional seed data, aggregated staff dashboard (`staff_activity_daily`, `staff_dashboard_stats`), events without identifiers |
| T744 | Protect pseudonymized data | `private.customer_pseudonyms` (not exposed), events reference pseudonyms (`sim_apply`) |
| T295 | No unencrypted data without ACL | Private `statements` bucket + owner-only policy (`0005_storage.sql`), in-memory generation |
| T214 | Protect confidential files | Nothing under `public/`, CSV formula neutralisation (`src/lib/csv.ts`), `no-store` downloads |
| T2602 | Log DB and server activity | `audit.capture()` triggers on money/card/auth/personal tables (`0004`, `0006`), `audit_event()` for logins, step-up, simulation, role changes |
| T349 | Protect audit logs | Append-only `audit.log` in an unexposed schema, append-only ledger, admin-only `admin_audit_log()`, reset keeps the trail |
| T2157 | Secure email | `src/services/email.service.ts` (header-injection guard, no financial data, consent check), SMTP/TLS settings in `docs/security.md` |
| T327 | Review Node modules | `.npmrc` `ignore-scripts`, `onlyBuiltDependencies`, lockfile, audit in CI; review notes in `docs/security.md` |
| T186 | Latest patches | Current stable versions (Next 16.4, React 19.3, supabase-js 2.119), `renovate.json`, `pnpm audit` clean |
| T49 | Release hardening | `SIMULATION_ADMIN_ENABLED` gate + admin role (404/403), `removeConsole` in production, no source maps, per-environment demo password |
| T2170 | Data localization (INFRA) | Documented in `docs/security.md` |
| T374 | Offload HTTP handling (INFRA) | Documented in `docs/security.md` |
| T69 | Strong server credentials (INFRA) | Documented in `docs/security.md` |

### Pending / outside the code

- **INFRA:** choose the data region (T2170), enable Vercel Firewall rules (T374), generate and rotate
  platform secrets (T69) - steps in `docs/security.md`.
- **Hosted Supabase settings:** CAPTCHA, leaked-password protection, custom SMTP with SPF/DKIM/DMARC and the
  redirect allow-list must be configured in the dashboard (local `config.toml` mirrors them where possible).
- **Email verification** is simulated (PRD requirement); production should send a real confirmation email.
- **SD Elements statuses** are unchanged in this step.

### Tests executed

| Check | Result |
|-------|--------|
| `pnpm lint` (incl. security rules: no-danger, DOM sinks, Math.random, weak crypto, TLS) | 0 errors, 0 warnings |
| `pnpm typecheck` | Passed |
| `pnpm test` - unit tests (money in cents, CSV injection, open redirect, authz matrix per role, enum/bound validation, LIKE escaping) | 43 passed |
| `pnpm test:db` - live database tests as customer / support / admin (IDOR, direct ledger writes, protected columns, simulation RPCs, masked staff search, audit access, storage isolation) | 9 passed |
| `pnpm audit --prod --audit-level=high` | No known vulnerabilities |
| `pnpm build` | Passed; all routes dynamic (per-request CSP nonce) |
| HTTP probes on the production build | Security headers + nonce CSP present; unauthenticated pages redirect, APIs return 401; cron without secret 401; cross-origin logout 403; unknown CORS origin gets no headers |
| Browser walkthrough (production build) | Account opening → login → overview; transfer with fee review and confirmation (pending → settled after advancing the clock, recipient credited); insufficient funds blocked; card block → simulated purchases declined live via Realtime; unblock with step-up; PDF statement generated and downloaded; logout clears access; admin dashboard, simulation and audit log; admin redirected away from customer pages; customer gets 403 on `/staff` and `/api/staff/*`; XSS payloads in references and support messages render as text; no CSP violations in the console |
