---
name: t76-do-not-hardcode-passwords
description: Keep ACME Bank's Supabase service-role key, DB passwords and API secrets out of source, seeds and client bundles; load them from validated environment variables managed in Vercel/Supabase.
---

# T76: Do not hardcode passwords

**Category:** CODE_FIX
**SD Elements:** [T76](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T76/)
**Priority:** 10

**Spec Context:**
> "Entregue o código completo, configuração do banco, dados iniciais, exemplos de variáveis de ambiente"
> Source: specs/PRD.md, paragraph 5

**What the spec implies (naive approach):**
Committing a working `.env` with the real service-role key "so it runs", demo-user passwords hardcoded in `seed.sql`, or `NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY` exposed to the browser.

**Secure Implementation Pattern:**
```ts
// src/lib/env.ts
import "server-only";
import { z } from "zod";
export const env = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  SIMULATION_ADMIN_ENABLED: z.enum(["true", "false"]).default("false"),
}).parse(process.env);
```
```sql
-- supabase/seed.sql: create demo users via the Auth Admin API in a seed script that reads
-- DEMO_USER_PASSWORD from the environment - never literal passwords in SQL.
```

**Implementation Guidance:**
- `.env.example` holds placeholders only, and `.env*` is git-ignored (already set in the scaffold).
- Never prefix secrets with `NEXT_PUBLIC_`. Import secret-reading modules only behind `server-only`.
- Add secret scanning (gitleaks or GitHub secret scanning) as a pre-commit or CI check.
- Generate demo credentials per environment and show them in the README as placeholders.

**Success Criteria:**
- [ ] No secrets in git history or the client bundle (`next build` output grep)
- [ ] The env schema fails fast when a variable is missing
- [ ] Secret scanning runs in CI

**Status:** Applied
