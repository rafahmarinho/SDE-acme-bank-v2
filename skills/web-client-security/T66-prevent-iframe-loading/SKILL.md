---
name: t66-prevent-web-pages-from-loading-in-iframe
description: Deny framing of all ACME Bank pages with CSP frame-ancestors and X-Frame-Options to prevent clickjacking on transfer and card controls; set baseline security headers.
---

# T66: Prevent web pages from being loaded inside iFrame

**Category:** CODE_FIX
**SD Elements:** [T66](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T66/)
**Priority:** 7

**Spec Context:**
> "transferir dinheiro, [...] bloquear o cartão e alterar limites. Mostre tarifas antes da confirmação"
> Source: specs/PRD.md, paragraph 3

**What the spec implies (naive approach):**
No framing protection, so a malicious page can overlay the "Confirm transfer" or "Unblock card" buttons in a transparent iframe.

**Secure Implementation Pattern:**
```ts
// next.config.ts
const securityHeaders = [
  { key: "Content-Security-Policy", value: [
      "default-src 'self'",
      "frame-ancestors 'none'",
      `connect-src 'self' ${process.env.NEXT_PUBLIC_SUPABASE_URL} wss://${new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host}`,
      "img-src 'self' data: blob:", "object-src 'none'", "base-uri 'self'", "form-action 'self'",
    ].join("; ") },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];
const nextConfig: NextConfig = { async headers() { return [{ source: "/(.*)", headers: securityHeaders }]; } };
```

**Implementation Guidance:**
- Apply the headers globally. Nothing in the PRD needs framing.
- Allow Supabase REST and the Realtime WebSocket in `connect-src`.
- Use nonce-based `script-src` for inline scripts (Next.js supports CSP nonces via middleware).

**Success Criteria:**
- [ ] Every HTML response has `frame-ancestors 'none'` and `X-Frame-Options: DENY`
- [ ] The app can't be framed (verified in a browser)
- [ ] Realtime still works under the CSP

**Status:** Pending
