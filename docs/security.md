# ACME Bank security notes

This file holds the security configuration that lives outside the code, and the dependency rules.

## Dependency policy (T327, T186)

- **Before adding a package,** check its maintainers, weekly downloads, last release date, open advisories and source repository. Prefer the packages already in the stack (Next.js, React, supabase-js, zod, shadcn/ui, @react-pdf/renderer) over small single-purpose ones.
- **Install scripts:** `.npmrc` sets `ignore-scripts=true`. A package that really needs a build script must be added to `pnpm.onlyBuiltDependencies` in `package.json` with a review note.
- **Lockfile:** commit `pnpm-lock.yaml`. CI installs with `--frozen-lockfile` and fails on `pnpm audit --prod --audit-level=high`.
- **Updates:** Renovate (`renovate.json`) opens security updates immediately and other updates weekly. Patch updates should merge within days. Subscribe to the GitHub Security Advisories for Next.js, React and Supabase.

## Secure platform settings to mirror in hosted environments

| Area | Setting |
|------|---------|
| Next.js | `poweredByHeader: false`, no browser source maps, nonce CSP (middleware), security headers (`next.config.ts`) |
| Supabase Auth | Signups disabled (accounts are opened server-side), email confirmations on, secure password change, minimum password length 12, leaked-password protection on, CAPTCHA (Turnstile) on, refresh-token rotation, JWT expiry 1 hour, OTP expiry 1 hour |
| Supabase Auth URLs | Site URL and redirect allow-list limited to the production domain plus `/reset-password` |
| Supabase SMTP | Custom SMTP over TLS from a dedicated domain with SPF, DKIM and DMARC (`p=quarantine` or stricter) |
| Supabase API | Exposed schemas: `public` only, `max_rows` 1000 |
| Supabase Storage | `statements` bucket private |
| Vercel | Environment variables set for Production only. `SUPABASE_SERVICE_ROLE_KEY`, `APP_SIGNING_KEY`, `APP_ENCRYPTION_KEY` and `CRON_SECRET` are marked Sensitive. Firewall managed rules on |
