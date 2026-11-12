---
name: t327-review-security-of-nodejs-modules
description: Vet every pnpm dependency for ACME Bank before adding it - provenance, maintenance, pnpm audit, lockfile, and blocking install scripts by default.
---

# T327: Review security of Node.js modules before installation

**Category:** CODE_FIX
**SD Elements:** [T327](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T327/)
**Priority:** 10

**Spec Context:**
> "deve usar Next.js, React e TypeScript, com Tailwind CSS e shadcn/ui. Use pnpm."
> Source: specs/PRD.md, paragraph 3

**What the spec implies (naive approach):**
Running `pnpm add` on whatever package a tutorial suggests (PDF, CSV, chart libraries), with lifecycle scripts allowed to run at install time.

**Secure Implementation Pattern:**
```ini
# .npmrc (already in scaffold)
ignore-scripts=true
```
```jsonc
// package.json
"pnpm": { "onlyBuiltDependencies": [] },        // explicitly allow-list packages that need build scripts
"scripts": { "audit": "pnpm audit --prod" }
```
```yaml
# CI step
- run: pnpm install --frozen-lockfile
- run: pnpm audit --prod --audit-level=high
```

**Implementation Guidance:**
- Before adding a package, check its maintainers, downloads, last release, open advisories and source repo.
- Prefer packages already in the stack (shadcn/ui, zod, supabase-js). Avoid tiny single-purpose packages.
- Commit `pnpm-lock.yaml`. Install with `--frozen-lockfile` in CI.
- Turn on Dependabot or Renovate plus `pnpm audit` in CI.

**Success Criteria:**
- [ ] The lockfile is committed and CI uses frozen installs
- [ ] Install scripts are blocked unless allow-listed
- [ ] `pnpm audit` reports no high or critical issues

**Status:** Applied
