---
name: t257-secure-cross-origin-resource-sharing
description: Configure ACME Bank's Vercel API CORS with an explicit origin allow-list (no wildcard with credentials) and keep authentication on every non-OPTIONS request.
---

# T257: Secure cross origin resource sharing (CORS)

**Category:** CODE_FIX
**SD Elements:** [T257](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T257/)
**Priority:** 8

**Spec Context:**
> "publicar a versão web e a API na Vercel"
> Source: specs/PRD.md, paragraph 5

**What the spec implies (naive approach):**
Adding `Access-Control-Allow-Origin: *` (or reflecting the request Origin) with `Allow-Credentials: true` so the web app and preview deployments can call the API.

**Secure Implementation Pattern:**
```ts
// src/middleware.ts (API branch)
const ALLOWED = new Set([process.env.NEXT_PUBLIC_SITE_URL!]);   // add explicit staging origin if needed
function applyCors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE");
    res.headers.set("Access-Control-Allow-Headers", "content-type,x-csrf-token");
    res.headers.set("Vary", "Origin");
  }
  return res;   // no CORS headers for unknown origins
}
```

**Implementation Guidance:**
- When the web app and API share one origin (the default Next.js setup), send no CORS headers at all.
- If cross-origin is needed, use an exact-match allow-list. No wildcards, regexes or `*.vercel.app`.
- Don't rely on Origin for authorization. Authenticate every request.

**Success Criteria:**
- [ ] No `Access-Control-Allow-Origin: *` on credentialed endpoints
- [ ] Requests from an unknown origin get no CORS headers
- [ ] `Vary: Origin` is set whenever CORS headers are sent

**Status:** Pending
