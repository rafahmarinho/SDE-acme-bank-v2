---
name: t558-authenticate-components-before-network-comms
description: Mutually authenticate ACME Bank components - the web app to the Vercel API, the API to Supabase (keys plus TLS server identity), and any scheduled jobs to the API (shared secret).
---

# T558: Authenticate all other components before any network communication with them

**Category:** CODE_FIX
**SD Elements:** [T558](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T558/)
**Priority:** 9

**Spec Context:**
> "publicar a versão web e a API na Vercel" ... "agendar pagamentos" ... "transferências que ficam pendentes antes de concluir"
> Source: specs/PRD.md, paragraphs 3 and 5

**What the spec implies (naive approach):**
A cron or settlement endpoint (`/api/scheduled-payments/run`, `/api/transfers/settle`) that anyone can call to process scheduled payments and settle pending transfers.

**Secure Implementation Pattern:**
```ts
// src/app/api/jobs/settle/route.ts - invoked by Vercel Cron
import { timingSafeEqual } from "node:crypto";
export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (auth.length !== expected.length || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected)))
    return new Response("Unauthorized", { status: 401 });
  await settlePendingTransfers();     // uses server-only admin client
  return Response.json({ ok: true });
}
```

**Implementation Guidance:**
- Protect every internal or job endpoint with a secret (Vercel Cron's `CRON_SECRET`), compared in constant time.
- The API authenticates Supabase via TLS server identity (T156) and authenticates to it with keys kept server-side.
- Supabase webhooks or database triggers that call the API must carry a signed secret, which the API verifies.

**Success Criteria:**
- [ ] Job and settlement endpoints return 401 without the secret
- [ ] No internal endpoint relies on obscurity

**Status:** Applied
