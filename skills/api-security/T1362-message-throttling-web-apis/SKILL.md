---
name: t1362-perform-message-throttling-in-web-apis
description: Rate limit ACME Bank's Vercel-hosted API routes and server actions (transfers, beneficiaries, card limits, support, statements) per user and per IP.
---

# T1362: Perform message throttling in Web APIs

**Category:** CODE_FIX
**SD Elements:** [T1362](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T1362/)
**Priority:** 8

**Spec Context:**
> "publicar a versão web e a API na Vercel" ... "transferir dinheiro, agendar pagamentos, bloquear o cartão e alterar limites"
> Source: specs/PRD.md, paragraphs 3 and 5

**What the spec implies (naive approach):**
Serverless route handlers with no request limits, so anyone can script thousands of transfer or statement-generation requests.

**Secure Implementation Pattern:**
```ts
// src/lib/rate-limit.ts - sliding window backed by a Postgres table or KV store
import "server-only";
export async function rateLimit(key: string, opts: { max: number; windowSec: number }) {
  const { data, error } = await adminClient().rpc("rate_limit_hit", {
    p_key: key, p_max: opts.max, p_window_seconds: opts.windowSec,
  });
  if (error) throw error;
  if (!data.allowed) throw new HttpError(429, { "Retry-After": String(data.retry_after) });
}

// src/app/api/transfers/route.ts
export async function POST(req: Request) {
  const { user } = await authorize("transfers", "POST");
  await rateLimit(`transfers:${user.id}`, { max: 10, windowSec: 60 });
  await rateLimit(`ip:${clientIp(req)}`, { max: 100, windowSec: 60 });
  // ...
}
```

**Implementation Guidance:**
- Set per-endpoint budgets: auth (strict), money movement (strict), reads (moderate), statement generation (strict, since it's expensive).
- Throttle per user ID and per IP. Return 429 with `Retry-After`.
- Turn on Vercel Firewall / WAF rate-limit rules as an outer layer (an infrastructure complement).

**Success Criteria:**
- [ ] All mutating endpoints are rate limited
- [ ] Going over the limit returns 429 with `Retry-After`
- [ ] Limits are covered by automated tests

**Status:** Applied
