---
name: t2602-log-database-and-server-activities
description: Record ACME Bank data changes (transfers, ledger posts, card blocks, limit changes, role changes, simulation resets) with actor, IDs, before/after values and timestamps via Postgres triggers and server logs.
---

# T2602: Log typical database and server activities and related metadata

**Category:** CODE_FIX
**SD Elements:** [T2602](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T2602/)
**Priority:** 8

**Spec Context:**
> "mantenha um histórico de lançamentos de débito e crédito" ... "consultar eventos e reiniciar os dados"
> Source: specs/PRD.md, paragraphs 3 and 5

**What the spec implies (naive approach):**
Treating the user-visible "events" list as the only log. Card limit changes, staff actions and data resets leave no trace of who did what.

**Secure Implementation Pattern:**
```sql
create table audit.log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid default auth.uid(), actor_role text default (auth.jwt()->'app_metadata'->>'role'),
  table_name text not null, op text not null, row_id uuid, old_data jsonb, new_data jsonb
);
create or replace function audit.capture() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into audit.log(table_name, op, row_id, old_data, new_data)
  values (tg_table_name, tg_op, coalesce(new.id, old.id), to_jsonb(old), to_jsonb(new));
  return coalesce(new, old);
end $$;
create trigger audit_cards after insert or update or delete on public.cards for each row execute function audit.capture();
-- repeat for transfers, ledger_entries, scheduled_payments, beneficiaries, profiles, user_roles
```

**Implementation Guidance:**
- Audit every table that holds money or authorization data.
- Server logs (structured JSON via Vercel log drains) should cover auth events, 4xx/5xx and simulation actions, each with a request ID.
- Never log passwords, tokens or full PII in the payload. Mask sensitive columns in `to_jsonb`.

**Success Criteria:**
- [ ] Every change to money or authorization tables produces an audit row with the actor
- [ ] Simulation reset and advance are logged with the admin's ID
- [ ] Logs contain no secrets

**Status:** Pending
