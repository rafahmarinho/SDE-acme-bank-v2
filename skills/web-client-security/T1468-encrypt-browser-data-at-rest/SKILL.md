---
name: t1468-encrypt-sensitive-data-at-rest-in-browser
description: Avoid storing ACME Bank balances, statements, tokens or personal data in localStorage/IndexedDB; use httpOnly cookie sessions and in-memory state, encrypting anything that must persist client-side.
---

# T1468: Encrypt sensitive data at rest in the browser

**Category:** CODE_FIX
**SD Elements:** [T1468](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T1468/)
**Priority:** 9

**Spec Context:**
> "Os resultados devem aparecer nas telas e continuar salvos após recarregar a aplicação."
> Source: specs/PRD.md, paragraph 5

**What the spec implies (naive approach):**
Meeting "persist after reload" by caching balances, transactions, the Supabase session and the user's profile in `localStorage` (the supabase-js browser default).

**Secure Implementation Pattern:**
```ts
// src/lib/supabase/client.ts - cookie storage via @supabase/ssr, not localStorage
import { createBrowserClient } from "@supabase/ssr";
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);  // session lives in cookies refreshed by middleware
// Persistence across reloads = server-side (PostgreSQL), re-fetched on load. Do not persist query caches.
// Only non-sensitive UI prefs (theme, collapsed sidebar) may go to localStorage.
```

**Implementation Guidance:**
- Satisfy "persists after reload" with database persistence and server rendering, not browser storage.
- Never put balances, ledger rows, statements, PII or tokens in localStorage, sessionStorage or IndexedDB.
- If offline support is ever added, encrypt with a key from the backend (WebCrypto AES-GCM) as the SD Elements guidance describes.

**Success Criteria:**
- [ ] DevTools → Application shows no sensitive data in local/session storage or IndexedDB
- [ ] Reloading the page still shows the persisted results (served from the DB)

**Status:** Pending
