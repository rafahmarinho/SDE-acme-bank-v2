---
name: t36-escape-untrusted-data-html-attributes-css-js
description: Prevent stored/reflected XSS in ACME Bank by relying on React's auto-escaping, banning dangerouslySetInnerHTML with user data, and validating URLs and CSS values from user input.
---

# T36: Escape untrusted data in HTML, HTML attributes, CSS, and JavaScript

**Category:** CODE_FIX
**SD Elements:** [T36](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T36/)
**Priority:** 8

**Spec Context:**
> "Next.js, React e TypeScript, com Tailwind CSS e shadcn/ui" ... "beneficiários", "suporte", "mensagens de erro"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
Rendering beneficiary nicknames, transfer references or support replies with `dangerouslySetInnerHTML` for "rich" formatting. Echoing raw error text, or putting user values into `href` or `style`.

**Secure Implementation Pattern:**
```tsx
// Safe default: React escapes text content
<p className="font-medium">{beneficiary.nickname}</p>

// Links from data: allow only http(s)
const safeHref = (u: string) => { try { const x = new URL(u); return ["https:", "http:"].includes(x.protocol) ? x.href : "#"; } catch { return "#"; } };

// If rich text is unavoidable (support replies), sanitize first:
import DOMPurify from "isomorphic-dompurify";
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(reply.body, { ALLOWED_TAGS: ["b","i","p","br","ul","li"] }) }} />
```

**Implementation Guidance:**
- Add an ESLint rule (`react/no-danger`) that fails the build when `dangerouslySetInnerHTML` is used without sanitization.
- Validate URL protocols for any user- or DB-sourced `href` or `src`.
- Never interpolate user data into `style`, `<script>`, or JSON embedded in HTML.
- Escape CSV cells against formula injection in statements (see skills/file-handling).

**Success Criteria:**
- [ ] No unsanitized `dangerouslySetInnerHTML`
- [ ] XSS payloads in beneficiary names, references and support text render as text
- [ ] `javascript:` URLs are neutralized

**Status:** Pending
