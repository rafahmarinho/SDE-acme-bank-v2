---
name: t156-validate-certificate-and-chain-of-trust
description: Keep default TLS certificate and hostname validation on for all ACME Bank outbound connections; never disable verification (NODE_TLS_REJECT_UNAUTHORIZED, rejectUnauthorized false).
---

# T156: Validate certificate and its chain of trust properly

**Category:** CODE_FIX
**SD Elements:** [T156](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T156/)
**Priority:** 7

**Spec Context:**
> "Supabase para PostgreSQL [...] arquivos e atualizações em tempo real" ... "a API na Vercel"
> Source: specs/PRD.md, paragraphs 2 and 5

**What the spec implies (naive approach):**
Setting `NODE_TLS_REJECT_UNAUTHORIZED=0` or `ssl: { rejectUnauthorized: false }` to get past certificate errors against Supabase Postgres or a local proxy during development, and then shipping it.

**Secure Implementation Pattern:**
```ts
// Startup guard (src/instrumentation.ts)
export function register() {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("TLS verification must not be disabled");
}
// Direct pg connections (migration scripts): use Supabase's CA certificate
// ssl: { ca: fs.readFileSync("supabase-ca.crt", "utf8"), rejectUnauthorized: true }
```

**Implementation Guidance:**
- Use the platform defaults (`fetch`, supabase-js), which validate the chain, hostname and expiry.
- For direct Postgres connections, use `sslmode=verify-full` with the Supabase root CA.
- Add a CI grep that fails on `rejectUnauthorized: false` or `NODE_TLS_REJECT_UNAUTHORIZED`.

**Success Criteria:**
- [ ] No code or config disables certificate validation
- [ ] The startup guard is present and tested

**Status:** Applied
