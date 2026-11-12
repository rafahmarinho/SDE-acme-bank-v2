---
name: t19-restrict-application-access-to-database
description: Apply least privilege to ACME Bank's Supabase database - anon/authenticated roles limited by grants and RLS, service-role key confined to server-only simulation and settlement code.
---

# T19: Restrict Application's Access to Database

**Category:** CODE_FIX
**SD Elements:** [T19](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T19/)
**Priority:** 8

**Spec Context:**
> "Entregue o código completo, configuração do banco, dados iniciais, exemplos de variáveis de ambiente" ... "Inclua uma área para escolher cenários, avançar a simulação, consultar eventos e reiniciar os dados."
> Source: specs/PRD.md, paragraph 5

**What the spec implies (naive approach):**
Using `SUPABASE_SERVICE_ROLE_KEY` everywhere because it "just works". That bypasses RLS for every user request. Default grants on all public tables, and "reset data" running as superuser from the browser.

**Secure Implementation Pattern:**
```sql
-- supabase/migrations/0001_init.sql (excerpt)
revoke all on all tables in schema public from anon, authenticated;
grant select on public.accounts, public.ledger_entries, public.cards, public.statements to authenticated;
grant insert on public.support_tickets, public.beneficiaries to authenticated;
-- money movement only via SECURITY DEFINER functions with strict checks, never direct INSERT on ledger
grant execute on function public.request_transfer(uuid, uuid, bigint, text) to authenticated;
revoke execute on function public.sim_reset_demo_data() from public, anon, authenticated;
alter table public.ledger_entries enable row level security;
```
```ts
// src/lib/supabase/admin.ts
import "server-only";                       // build fails if imported from a client component
export const adminClient = () => createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });     // used ONLY by simulation/settlement services
```

**Implementation Guidance:**
- Use the user-scoped client (anon key + user JWT) for all customer and staff requests.
- Keep the service role to `simulation.service.ts` and settlement jobs, behind an admin authorization check.
- Revoke default privileges, then grant per table and per action. Expose money movement only through RPC functions.
- Keep `SECURITY DEFINER` functions minimal: set `search_path`, check `auth.uid()`, and validate the amounts.

**Success Criteria:**
- [ ] `SUPABASE_SERVICE_ROLE_KEY` is referenced only in `src/lib/supabase/admin.ts`
- [ ] The `authenticated` role can't insert into or update `ledger_entries` directly
- [ ] The reset/simulation functions can't be executed by `authenticated`

**Status:** Applied
