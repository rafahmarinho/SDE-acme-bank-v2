---
name: t186-latest-patches-for-third-party-libraries
description: Keep Next.js, React, Supabase clients, Tailwind and shadcn/ui components on current stable patched versions with secure settings, tracking vendor security advisories.
---

# T186: Use recommended settings and the latest patches for third party libraries and software

**Category:** CODE_FIX
**SD Elements:** [T186](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T186/)
**Priority:** 10

**Spec Context:**
> "Use versões atuais e estáveis das tecnologias e Supabase para PostgreSQL" ... "Next.js, React e TypeScript, com Tailwind CSS e shadcn/ui"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
Pinning whatever versions were current at scaffold time and never updating. That misses framework advisories such as Next.js middleware-bypass and RSC CVEs.

**Secure Implementation Pattern:**
```jsonc
// renovate.json
{ "extends": ["config:recommended"], "vulnerabilityAlerts": { "labels": ["security"] },
  "packageRules": [{ "matchPackageNames": ["next", "react", "react-dom", "@supabase/*"], "groupName": "core" }] }
```
```ts
// Secure defaults to apply:
// next.config.ts: poweredByHeader: false, productionBrowserSourceMaps: false (default), security headers (T66)
// Supabase: RLS enabled everywhere, Auth email confirmations on, leaked-password protection on
```

**Implementation Guidance:**
- Subscribe to the Next.js, React and Supabase security advisories (GitHub Security Advisories).
- Update patch releases within days, and minors on a regular cadence.
- Review the secure settings for each library (see the SD Elements How-tos for this countermeasure).
- Re-run the full test suite and `pnpm audit` after each update.

**Success Criteria:**
- [ ] Automated dependency updates are configured
- [ ] No dependencies with known high or critical CVEs
- [ ] The secure configuration for Next.js and Supabase is documented

**Status:** Pending
