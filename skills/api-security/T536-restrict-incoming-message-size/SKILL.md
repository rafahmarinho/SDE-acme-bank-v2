---
name: t536-restrict-the-size-of-incoming-messages
description: Cap request body and field sizes for ACME Bank route handlers and server actions (support messages, beneficiary forms, account opening) to prevent resource exhaustion.
---

# T536: Restrict the size of incoming messages in services

**Category:** CODE_FIX
**SD Elements:** [T536](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T536/)
**Priority:** 8

**Spec Context:**
> "Crie páginas de abertura de conta, [...] beneficiários, pagamentos agendados, cartões, extratos, suporte" ... "a API na Vercel"
> Source: specs/PRD.md, paragraphs 3 and 5

**What the spec implies (naive approach):**
Route handlers that call `await req.json()` on any payload, and support tickets with unbounded message text.

**Secure Implementation Pattern:**
```ts
// next.config.ts
const nextConfig: NextConfig = { experimental: { serverActions: { bodySizeLimit: "100kb" } } };

// src/lib/http.ts
export async function readJson<T>(req: Request, schema: z.ZodType<T>, maxBytes = 16_384) {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > maxBytes) throw new HttpError(413);
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413);
  return schema.parse(JSON.parse(text));
}
// Field limits: z.string().max(2000) for support messages, max(140) for transfer reference, etc.
```

**Implementation Guidance:**
- Set a global server-action body limit and per-route byte limits.
- Put maximum lengths and array sizes on every zod schema.
- Return 413 for oversized payloads before parsing them.

**Success Criteria:**
- [ ] Server actions have a configured `bodySizeLimit`
- [ ] Every route handler reads its body through the size-limited helper
- [ ] Oversized requests get a 413

**Status:** Pending
