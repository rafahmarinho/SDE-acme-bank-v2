---
name: t184-authorization-checks-on-restful-web-services
description: Authorize every ACME Bank API route by user, role and HTTP method, keeping staff and admin operations restricted to those roles.
---

# T184: Perform authorization checks on RESTful web services

**Category:** CODE_FIX
**SD Elements:** [T184](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T184/)
**Priority:** 9

**Spec Context:**
> "um README com os passos para rodar e publicar a versão web e a API na Vercel" ... "Tenha perfis de cliente, suporte e administrador."
> Source: specs/PRD.md, paragraphs 4 and 5

**What the spec implies (naive approach):**
Route handlers under `src/app/api/*` that check only that the user is logged in. A customer can then `PATCH /api/cards/{id}` or call the staff endpoints directly.

**Secure Implementation Pattern:**
```ts
// src/lib/authz.ts
import "server-only";
type Role = "customer" | "support" | "admin";
const POLICY: Record<string, Partial<Record<"GET"|"POST"|"PATCH"|"DELETE", Role[]>>> = {
  "transfers":          { GET: ["customer"], POST: ["customer"] },
  "cards/:id":          { GET: ["customer", "support"], PATCH: ["customer", "admin"] },
  "staff/customers":    { GET: ["support", "admin"] },
  "simulation":         { GET: ["admin"], POST: ["admin"] },
};
export async function authorize(resource: keyof typeof POLICY, method: string) {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new HttpError(401);
  const role = (user.app_metadata?.role ?? "customer") as Role;
  const allowed = POLICY[resource]?.[method as "GET"];
  if (!allowed?.includes(role)) throw new HttpError(403);
  return { user, role, supabase };
}
// In each route.ts: const { user, supabase } = await authorize("cards/:id", req.method);
```

**Implementation Guidance:**
- Deny by default: a resource or method missing from the policy map returns 403.
- Pass the user-scoped Supabase client (not the service role) to the data layer, so RLS applies as a second check.
- Only admins can reach admin and management functions (simulation reset, role assignment).
- Return 401 or 403 with no stack traces or object details.

**Success Criteria:**
- [ ] Every route handler calls `authorize()` before doing any work
- [ ] Unlisted methods return 403
- [ ] Customers can't call staff or simulation endpoints
- [ ] Tests cover each role against each endpoint

**Status:** Applied
