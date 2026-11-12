---
name: t29-use-anti-csrf-tokens
description: Protect ACME Bank state-changing requests (transfers, scheduled payments, card block, limit changes, logout) from CSRF with Origin checks, SameSite cookies and tokens for custom route handlers.
---

# T29: Use anti-Cross-Site Request Forgery (CSRF) tokens

**Category:** CODE_FIX
**SD Elements:** [T29](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T29/)
**Priority:** 7

**Spec Context:**
> "transferir dinheiro, agendar pagamentos, bloquear o cartão e alterar limites. Mostre tarifas antes da confirmação"
> Source: specs/PRD.md, paragraph 3

**What the spec implies (naive approach):**
Cookie-authenticated `POST /api/transfers` route handlers with no CSRF defense. A malicious site can then auto-submit a transfer form.

**Secure Implementation Pattern:**
```ts
// Server Actions: Next.js compares Origin vs Host automatically - keep it, and set allowedOrigins explicitly.
// next.config.ts: experimental: { serverActions: { allowedOrigins: ["acme-bank.vercel.app"] } }

// Route handlers (src/lib/csrf.ts)
import "server-only";
export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(process.env.NEXT_PUBLIC_SITE_URL!).host) throw new HttpError(403);
}
export function assertCsrfToken(req: Request, cookieToken: string | undefined) {
  const header = req.headers.get("x-csrf-token");
  if (!cookieToken || !header || !timingSafeEqual(Buffer.from(header), Buffer.from(cookieToken))) throw new HttpError(403);
}
// Transfers: the confirmation step (fee shown) issues a one-time transaction token bound to the quote.
```

**Implementation Guidance:**
- Prefer Server Actions for mutations, since they come with Origin checking.
- Custom route handlers need an Origin check plus a double-submit or synchronizer token.
- Keep session cookies `SameSite=Lax` or stricter. Never mutate state on GET.
- Bind each transfer confirmation to a single-use token tied to the displayed fee quote.

**Success Criteria:**
- [ ] Cross-origin POSTs to mutation endpoints return 403
- [ ] No GET endpoint changes state
- [ ] Transfer confirmation tokens are single-use

**Status:** Pending
