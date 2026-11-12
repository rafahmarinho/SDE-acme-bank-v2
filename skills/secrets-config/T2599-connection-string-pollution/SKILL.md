---
name: t2599-protect-against-connection-string-pollution
description: Build ACME Bank's Supabase/Postgres connection settings only from fixed, validated environment configuration - never from user input or request data.
---

# T2599: Protect against connection string parameter pollution

**Category:** CODE_FIX
**SD Elements:** [T2599](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T2599/)
**Priority:** 9

**Spec Context:**
> "Supabase para PostgreSQL" ... "configuração do banco, dados iniciais, exemplos de variáveis de ambiente"
> Source: specs/PRD.md, paragraphs 2 and 5

**What the spec implies (naive approach):**
A "choose scenario / environment" feature in the simulation area that switches the database by building a connection URL or Supabase URL from a request parameter, or appending query options to `DATABASE_URL`.

**Secure Implementation Pattern:**
```ts
// Connection settings come only from validated env (src/lib/env.ts); clients are created once.
export const supabaseUrl = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
const isProd = process.env.NODE_ENV === "production";
if (isProd && (supabaseUrl.protocol !== "https:" || !supabaseUrl.host.endsWith(".supabase.co")))
  throw new Error("Invalid Supabase URL");
// Scenarios are data inside ONE database (scenario_id column), not separate connections.
```

**Implementation Guidance:**
- Never build connection strings or Supabase URLs from user input.
- Model simulation scenarios as rows or a schema in the same project, not as separate DB connections.
- Keep any direct Postgres URL (migrations only) in CI secrets, with `sslmode=require` fixed.

**Success Criteria:**
- [ ] Connection configuration is read only from env at startup
- [ ] No request parameter influences the DB/client configuration

**Status:** Applied
