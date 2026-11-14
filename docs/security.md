# ACME Bank security notes

This file holds the security configuration that lives **outside the code** (Supabase and Vercel
platform settings), the dependency rules, and design decisions worth knowing before deploying.
The per-countermeasure map of where things are implemented in code is in the README ("Security").

## INFRA countermeasures (configure on the platforms)

### T2170 - Data localization
Personal data is stored in Supabase (PostgreSQL + Storage) and processed in Vercel Functions. Where it
lives is decided by platform configuration, not code.

1. The privacy officer picks the jurisdiction(s) and records the decision in the Data Processing Register.
2. Create the Supabase project in the matching region (for example `sa-east-1` for Brazil / LGPD residency,
   `eu-central-1` for the EU). The region can't be changed later without a migration.
3. Pin the Vercel function region to the same area: in `vercel.json` add `"regions": ["gru1"]` (or the
   matching region code), or set it under Project Settings > Functions.
4. Supabase Auth email (SMTP provider) and log drains also process personal data - choose providers and
   regions accordingly.

### T374 - Offload HTTP request handling
There is no self-managed HTTP server: Vercel's edge terminates TLS, buffers requests and absorbs DDoS.
App-level limits are in code (T35, T536, T1362). On Vercel:

- Enable **Firewall > Managed rules** (OWASP core set, bot protection).
- Add **rate-limit rules** for `/api/*`, `/login`, `/forgot-password` and `/open-account` (for example
  100 requests / 60 s per IP), as an outer layer in front of the Postgres-backed limiter.
- Know how to turn on **Attack Challenge Mode** during incidents; review Firewall analytics weekly.

### T69 - Strong server-to-server credentials
| Secret | Where | Requirement |
|--------|-------|-------------|
| Supabase database password | Supabase > Settings > Database | 32+ random characters, used only for migrations from CI |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env (Production, **Sensitive**) | Never in the browser; rotate by rolling the JWT secret / API keys |
| `CRON_SECRET` | Vercel env (Production, Sensitive) | 32+ random bytes (`openssl rand -base64 32`) |
| `APP_SIGNING_KEY`, `APP_ENCRYPTION_KEY` | Vercel env (Production, Sensitive) | 32 random bytes each, base64 |
| `DEMO_USER_PASSWORD` | Local / demo environments only | Different per environment; never set in production |

Rotate on staff changes and at least every 90 days. Limit who can see Supabase and Vercel project settings.

## Secure platform settings to mirror in hosted environments

| Area | Setting |
|------|---------|
| Next.js | `poweredByHeader: false`, no browser source maps, nonce CSP (`src/proxy.ts`), security headers (`next.config.ts`) |
| Supabase Auth | Signups **disabled** (accounts are opened server-side by the account-opening flow), minimum password length 12 with upper/lower/digit, leaked-password protection on, CAPTCHA (Turnstile) on, refresh-token rotation with reuse detection, JWT expiry 1 hour, OTP/recovery expiry 1 hour, secure password change |
| Supabase Auth URLs | Site URL = production domain; redirect allow-list = `https://<domain>/auth/confirm` only |
| Supabase Auth email templates | Use `supabase/templates/recovery.html` (token-hash link to `/auth/confirm`, no other data) |
| Supabase SMTP | Custom SMTP over TLS (465 / 587 STARTTLS) from a dedicated domain with SPF, DKIM and DMARC `p=quarantine` or stricter |
| Supabase API | Exposed schemas: `public` only (`audit` and `private` stay hidden); `max_rows` 1000 |
| Supabase Storage | `statements` bucket private (migration `0005`) |
| Supabase Realtime | Tables in the `supabase_realtime` publication are RLS-protected (migration `0006`) |
| Vercel | Env vars for Production only; secrets marked Sensitive; Firewall managed rules on; log drain to a retained, append-only store (T349) |
| Vercel Cron | `/api/jobs/settle` every 15 min (`vercel.json`). On the Hobby plan crons run at most once a day - pending transfers then settle on the daily run or when an admin advances the simulation clock |

## Design decisions to know

- **Simulated email/identity verification.** The PRD asks for simulated integrations, so the account-opening
  flow marks the email as confirmed. For a real deployment, switch to a confirmation email
  (`email_confirm: false` + Supabase confirmation template pointing to `/auth/confirm`).
- **Step-up authentication.** Adding a beneficiary, unblocking a card, raising a card limit, changing a
  password and changing a user's role require the password again within 10 minutes (HMAC-signed,
  httpOnly, SameSite=Strict cookie). The REST card endpoint enforces the same rule.
- **CSP.** Production: nonce-based `script-src` and `style-src` with `strict-dynamic`, `frame-ancestors 'none'`.
  `style-src-attr 'unsafe-inline'` is allowed for `style=""` attributes (progress bars); no user data is
  ever placed in styles. Development relaxes `style-src` for Next.js dev tooling only.
- **Local production builds.** `env.public.ts` and `instrumentation.ts` require https and `*.supabase.co`
  in production, except loopback hosts (`localhost` / `127.0.0.1`) so `next start` works against the local stack.
- **Simulation controls** exist only when `SIMULATION_ADMIN_ENABLED=true` and only for admins; keep the flag
  `false` anywhere real users exist. Reset affects demo customers (`profiles.is_demo`) only and never the audit trail.

## Database access matrix

The role/object matrix is the comment block at the top of `supabase/migrations/0003_security.sql`;
`0006_banking_features.sql` adds card authorizations (owner + staff read), staff functions that re-check
the role in SQL, and column grants for support tickets. `tests/db.integration.test.ts` asserts the denials
against a live database.

## Dependency policy (T327, T186)

- **Before adding a package,** check its maintainers, weekly downloads, last release date, open advisories and
  source repository. Prefer the packages already in the stack. Added in this iteration after review:
  `radix-ui` (WorkOS-maintained primitives used by shadcn/ui) and `tw-animate-css` (CSS only).
- **Install scripts:** `.npmrc` sets `ignore-scripts=true`. A package that really needs a build script must be
  added to `pnpm.onlyBuiltDependencies` in `package.json` with a review note.
- **Lockfile:** commit `pnpm-lock.yaml`. CI installs with `--frozen-lockfile` and fails on `pnpm audit --prod --audit-level=high`.
- **Updates:** Renovate (`renovate.json`) opens security updates immediately and other updates weekly.
  Subscribe to the GitHub Security Advisories for Next.js, React and Supabase.
