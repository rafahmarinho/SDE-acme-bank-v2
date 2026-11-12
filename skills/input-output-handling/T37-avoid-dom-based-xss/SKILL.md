---
name: t37-avoid-dom-based-cross-site-scripting
description: Prevent DOM XSS in ACME Bank client components that read URL state (search, filters, redirect params) by using safe rendering APIs and validating redirect targets.
---

# T37: Avoid DOM-based Cross-Site Scripting (XSS)

**Category:** CODE_FIX
**SD Elements:** [T37](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T37/)
**Priority:** 8

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações, busca, filtros, estados de carregamento e mensagens de erro."
> Source: specs/PRD.md, paragraph 2

**What the spec implies (naive approach):**
Keeping search terms and filters in the URL (`?q=`, `?next=`) and writing them into the DOM via `innerHTML`, or redirecting after login to `window.location = searchParams.get("next")`.

**Secure Implementation Pattern:**
```tsx
"use client";
const params = useSearchParams();
const q = params.get("q") ?? "";
return <p>Results for <span>{q}</span></p>;      // React text node - safe

// Post-login redirect: only same-origin relative paths
function safeNext(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/overview";
  return next;
}
router.replace(safeNext(params.get("next")));
```

**Implementation Guidance:**
- Never use `innerHTML`, `outerHTML`, `document.write`, `eval` or `new Function` with URL- or DOM-derived data.
- Validate redirect parameters as relative paths only, to block open redirects and `javascript:` URLs.
- Apply a strict CSP (see skills/web-client-security/T66) as defense in depth.

**Success Criteria:**
- [ ] No unsafe DOM sinks in client components (lint rule enforced)
- [ ] `?next=javascript:...` and `?next=//evil` both redirect to /overview
- [ ] Search terms with HTML render as plain text

**Status:** Applied
