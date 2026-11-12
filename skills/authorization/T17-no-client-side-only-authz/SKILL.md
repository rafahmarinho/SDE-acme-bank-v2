---
name: t17-do-not-only-rely-on-client-side-authorization
description: Ensure ACME Bank's role-adaptive navigation is cosmetic only; every authorization decision is repeated on the server (middleware, server actions, route handlers, RLS).
---

# T17: Do not only rely on client-side authorization

**Category:** CODE_FIX
**SD Elements:** [T17](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T17/)
**Priority:** 8

**Spec Context:**
> "Adapte a navegação aos perfis de usuário." ... "com menu lateral no desktop e navegação inferior no celular."
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
React components such as `{role === "admin" && <Link href="/simulation">}` act as the only control. A user can still browse to `/staff` or `/simulation`, or call server actions directly.

**Secure Implementation Pattern:**
```tsx
// src/app/(staff)/layout.tsx (Server Component)
import { redirect } from "next/navigation";
export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;
  if (role !== "support" && role !== "admin") redirect("/overview");
  return <>{children}</>;
}

// Every server action re-checks too - server actions are public HTTP endpoints:
export async function blockCard(cardId: string) {
  "use server";
  const { user } = await authorize("cards/:id", "PATCH");
  // ...
}
```

**Implementation Guidance:**
- Build the navigation from the server-resolved role and treat it as UX only.
- Check the role in Server Component layouts, in every server action and route handler, and in RLS.
- Never send role flags from the client (hidden inputs, request bodies) for the server to trust.

**Success Criteria:**
- [ ] Directly visiting `/staff` as a customer redirects or returns 403
- [ ] Each server action re-authorizes on its own
- [ ] No authorization decision reads a client-supplied role

**Status:** Pending
