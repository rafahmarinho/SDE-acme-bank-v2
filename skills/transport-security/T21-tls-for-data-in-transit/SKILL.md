---
name: t21-encrypt-all-data-in-transit-with-tls
description: Ensure every ACME Bank connection (browser to Vercel, Vercel to Supabase REST/Realtime/Storage, email) uses TLS 1.2+, with HSTS and no plaintext fallbacks.
---

# T21: Ensure all data in transit is encrypted using a secure TLS channel

**Category:** CODE_FIX
**SD Elements:** [T21](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T21/)
**Priority:** 8

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha, arquivos e atualizações em tempo real" ... "publicar a versão web e a API na Vercel"
> Source: specs/PRD.md, paragraphs 2 and 5

**What the spec implies (naive approach):**
`http://` URLs in env files, `ws://` realtime in local configs that leak into production, and no HSTS, which allows downgrade attacks on login.

**Secure Implementation Pattern:**
```ts
// src/lib/env.ts - enforce https in production
const url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("Supabase URL must be https");
// next.config.ts headers: Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
// Direct Postgres connections (migrations/CI): postgresql://...?...&sslmode=require
```

**Implementation Guidance:**
- Vercel terminates TLS at the edge. Add HSTS in the app (see T66 headers) and redirect HTTP to HTTPS.
- Use `https://` and `wss://` for Supabase. Fail at startup otherwise.
- Supabase Auth SMTP must use TLS (port 465/587 with STARTTLS).
- Refuse plaintext login (no HTTP endpoints at all).

**Success Criteria:**
- [ ] HSTS header present on all responses
- [ ] No `http://` or `ws://` URLs in production config
- [ ] SSL Labs grade A or better on the production domain

**Status:** Pending
