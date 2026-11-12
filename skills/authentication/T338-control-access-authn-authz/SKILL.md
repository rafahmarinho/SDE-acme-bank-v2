---
name: t338-control-access-through-authn-and-authz
description: Enforce authentication and role-based authorization (customer, support, administrator) on every ACME Bank page, API and data object, with step-up auth for sensitive operations and an easy logout.
---

# T338: Control access to resources through user authentication and authorization

**Category:** CODE_FIX
**SD Elements:** [T338](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T338/)
**Priority:** 7

**Spec Context:**
> "Adapte a navegação aos perfis de usuário." ... "Tenha perfis de cliente, suporte e administrador." ... "um painel para a equipe do banco"
> Source: specs/PRD.md, paragraphs 2 and 4

**What the spec implies (naive approach):**
"Adapting navigation" by hiding menu items per role in the UI. Routes, APIs and tables stay reachable by any logged-in user.

**Secure Implementation Pattern:**
```ts
// src/middleware.ts
type Role = "customer" | "support" | "admin";
const ROLE_ROUTES: Array<[prefix: string, roles: Role[]]> = [
  ["/staff", ["support", "admin"]],
  ["/simulation", ["admin"]],
  ["/api/staff", ["support", "admin"]],
  ["/api/simulation", ["admin"]],
];

export async function middleware(req: NextRequest) {
  const { supabase, res } = createMiddlewareClient(req);
  const { data: { user } } = await supabase.auth.getUser();       // validated with Auth server
  if (!user && !isPublicPath(req.nextUrl.pathname)) return NextResponse.redirect(new URL("/login", req.url));
  const role = (user?.app_metadata?.role ?? "customer") as Role;  // app_metadata is not user-editable
  const rule = ROLE_ROUTES.find(([p]) => req.nextUrl.pathname.startsWith(p));
  if (rule && !rule[1].includes(role)) return new NextResponse("Forbidden", { status: 403 });
  return res;
}
```

**Implementation Guidance:**
- Store roles in `app_metadata` or in a `user_roles` table that only the service role can write. Never put them in `user_metadata`.
- Enforce authorization in three layers: middleware (routes), server actions and route handlers, and PostgreSQL RLS (see skills/data-access).
- Require step-up re-authentication for transfers to new beneficiaries, limit changes and card unblocks.
- Put a logout control on every authenticated layout (desktop side menu and mobile bottom nav).

**Success Criteria:**
- [ ] Unauthenticated requests to app and staff routes are redirected or rejected
- [ ] Customers get a 403 on /staff and /simulation, including the API equivalents
- [ ] Users can't change their own role
- [ ] Sensitive actions require recent re-authentication

**Status:** Applied
