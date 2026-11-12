---
name: t20-unique-session-ids-and-reset-after-auth
description: Use Supabase Auth's server-issued sessions correctly in Next.js (fresh session on login, new session on privilege change, httpOnly cookies, server-side validation) to prevent session fixation.
---

# T20: Generate unique session IDs and reset old IDs after authentication

**Category:** CODE_FIX
**SD Elements:** [T20](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T20/)
**Priority:** 9

**Spec Context:**
> "login por e-mail e senha" ... "Os resultados devem aparecer nas telas e continuar salvos após recarregar a aplicação."
> Source: specs/PRD.md, paragraphs 2 and 5

**What the spec implies (naive approach):**
Keeping the Supabase session in localStorage and trusting `getSession()` on the server. The same tokens survive after a user's role changes, for example when they're promoted to support.

**Secure Implementation Pattern:**
```ts
// src/lib/supabase/server.ts
import "server-only";
import { createServerClient as create } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createServerClient() {
  const store = await cookies();
  return create(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => list.forEach(({ name, value, options }) =>
        store.set(name, value, { ...options, httpOnly: true, secure: true, sameSite: "lax", path: "/" })),
    },
  });
}
// Server code must ALWAYS call supabase.auth.getUser() (validates the token); never trust getSession() alone.
// After a role change in the staff panel: revoke the target user's sessions (Admin API) so new claims are issued.
```

**Implementation Guidance:**
- Use `@supabase/ssr` cookie-based sessions, refreshed in `src/middleware.ts`.
- Never accept access or refresh tokens from query strings or request bodies.
- Before signing in, sign out any existing session on that device.
- When an admin changes a user's role, revoke that user's sessions so new claims take effect.
- Keep JWT expiry at 1 hour or less, and enable refresh-token rotation with reuse detection in Supabase Auth.

**Success Criteria:**
- [ ] Session cookies are httpOnly, Secure and SameSite=Lax or stricter
- [ ] Server-side auth decisions use `getUser()`
- [ ] A role change forces a new session
- [ ] Refresh-token rotation and reuse detection are enabled

**Status:** Applied
