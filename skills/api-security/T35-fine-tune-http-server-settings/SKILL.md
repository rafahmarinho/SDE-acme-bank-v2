---
name: t35-fine-tune-http-server-settings
description: Configure ACME Bank's Next.js/Vercel request limits, function timeouts and header limits, and alert on violations.
---

# T35: Fine-tune HTTP server settings

**Category:** CODE_FIX
**SD Elements:** [T35](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T35/)
**Priority:** 9

**Spec Context:**
> "um README com os passos para rodar e publicar a versão web e a API na Vercel"
> Source: specs/PRD.md, paragraph 5

**What the spec implies (naive approach):**
Default deployment with no per-route timeouts or limits, where slow statement-generation requests can tie up functions.

**Secure Implementation Pattern:**
```ts
// src/app/api/statements/[statementId]/route.ts
export const maxDuration = 15;          // seconds - Vercel function timeout per route
export const dynamic = "force-dynamic";

// vercel.json
// { "functions": { "src/app/api/**/route.ts": { "maxDuration": 10, "memory": 1024 } } }

// next.config.ts - also strip framework fingerprinting
const nextConfig: NextConfig = { poweredByHeader: false, experimental: { serverActions: { bodySizeLimit: "100kb" } } };
```

**Implementation Guidance:**
- Set `maxDuration` per route (short for CRUD, longer only for PDF generation).
- Combine with the body limits (T536) and rate limits (T1362).
- Disable `x-powered-by`. Set request timeouts on outbound Supabase calls.
- Configure Vercel alerting/log drains so limit violations reach the administrators.

**Success Criteria:**
- [ ] Every API route has an explicit `maxDuration`
- [ ] `poweredByHeader: false`
- [ ] Limit violations show up in logs and alerts

**Status:** Pending
