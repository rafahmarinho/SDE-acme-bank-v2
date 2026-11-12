---
name: t49-disable-debug-capabilities-prepare-for-release
description: Gate or remove ACME Bank's simulation controls (scenario picker, advance clock, reset data), debug output and demo backdoors before release; admin-only behind an explicit flag.
---

# T49: Disable and remove debug capabilities and code/data, and prepare application for release

**Category:** CODE_FIX
**SD Elements:** [T49](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T49/)
**Priority:** 7

**Spec Context:**
> "Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados." ... "Prepare dados de demonstração com seis clientes"
> Source: specs/PRD.md, paragraph 5

**What the spec implies (naive approach):**
A public `/simulation` page and `/api/simulation/reset` that anyone can hit, demo users with known passwords, and `console.log` of sessions and queries left in production.

**Secure Implementation Pattern:**
```ts
// src/app/api/simulation/route.ts
export async function POST(req: Request) {
  if (env.SIMULATION_ADMIN_ENABLED !== "true") return new Response("Not found", { status: 404 });
  const { user } = await authorize("simulation", "POST");     // admin role only
  const action = SimAction.parse(await readJson(req, SimAction));
  await audit("simulation", action, user.id);
  return Response.json(await runSimulationAction(action));
}
// next.config.ts: compiler: { removeConsole: { exclude: ["error", "warn"] } }
```

**Implementation Guidance:**
- Put the simulation area behind the admin role and the `SIMULATION_ADMIN_ENABLED` flag, which defaults to false.
- Rotate demo-user credentials per environment, and disable demo logins in any real deployment.
- Strip debug logs and verbose error pages. Never ship source maps publicly.
- Remove unused files, test fixtures and annotations that reveal internals.

**Success Criteria:**
- [ ] Simulation endpoints return 404 when the flag is off, and 403 for non-admins
- [ ] No `console.log` with sensitive data in production builds
- [ ] Demo credentials aren't shared across environments

**Status:** Applied
