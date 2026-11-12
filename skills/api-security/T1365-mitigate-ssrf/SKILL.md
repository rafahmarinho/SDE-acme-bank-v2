---
name: t1365-mitigate-server-side-request-forgery
description: Ensure ACME Bank's simulated external integrations and any server-side fetches only call allow-listed hosts and schemes, never user-supplied URLs.
---

# T1365: Mitigate Server Side Request Forgery

**Category:** CODE_FIX
**SD Elements:** [T1365](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T1365/)
**Priority:** 8

**Spec Context:**
> "Quero as telas funcionando e os dados persistidos, com integrações externas simuladas." ... "a API na Vercel"
> Source: specs/PRD.md, paragraphs 2 and 5

**What the spec implies (naive approach):**
A "simulated integration" or webhook-tester feature that takes a callback URL, or fetches beneficiary bank logos and avatars from URLs the user supplies, server-side from Vercel.

**Secure Implementation Pattern:**
```ts
// src/lib/outbound.ts
import "server-only";
const ALLOWED_HOSTS = new Set([new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host]);
export async function safeFetch(url: string, init?: RequestInit) {
  const u = new URL(url);
  if (u.protocol !== "https:") throw new Error("scheme not allowed");
  if (!ALLOWED_HOSTS.has(u.host)) throw new Error("host not allowed");
  const res = await fetch(u, { ...init, redirect: "error", signal: AbortSignal.timeout(5000) });
  return res;
}
// Simulated integrations (card network, payment rails) are local modules - no outbound calls.
```

**Implementation Guidance:**
- Implement the PRD's "simulated external integrations" in-process (local stubs), with no network calls.
- If you do need an outbound call, use an allow-list of hosts. Allow `https:` only, no redirects, with timeouts.
- Never accept URLs in request bodies or query params for the server to fetch.
- Validate response shape (zod) before relaying data to users.

**Success Criteria:**
- [ ] No server code calls `fetch` with a user-controlled URL
- [ ] All outbound calls go through `safeFetch` with an allow-list
- [ ] Simulated integrations make no network requests

**Status:** Applied
