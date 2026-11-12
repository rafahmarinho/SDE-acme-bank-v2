---
name: t349-protect-audit-information-and-logs
description: Make ACME Bank's ledger and audit tables append-only and inaccessible to customers and support, and ensure simulation reset does not erase the audit trail.
---

# T349: Protect audit information and logs against unauthorized access

**Category:** CODE_FIX
**SD Elements:** [T349](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T349/)
**Priority:** 7

**Spec Context:**
> "mantenha um histórico de lançamentos de débito e crédito, com valores em centavos" ... "reiniciar os dados"
> Source: specs/PRD.md, paragraphs 3 and 5

**What the spec implies (naive approach):**
A "reset data" action that runs `truncate` on every table, audit log included, and ledger rows that can be updated or deleted to "fix" balances.

**Secure Implementation Pattern:**
```sql
create schema audit;                                  -- not exposed via PostgREST
revoke all on schema audit from anon, authenticated;
-- Append-only ledger: no UPDATE/DELETE for anyone but a migration role
revoke update, delete on public.ledger_entries from authenticated, service_role;
create or replace function public.forbid_mutation() returns trigger language plpgsql as $$
begin raise exception 'ledger_entries is append-only'; end $$;
create trigger ledger_immutable before update or delete on public.ledger_entries
  for each row execute function public.forbid_mutation();
-- Simulation reset: delete demo rows by scenario_id in public.*; NEVER touch audit.* - insert a 'reset' audit row instead.
```

**Implementation Guidance:**
- Correct mistakes with reversing entries, never by editing the ledger.
- Keep audit data in a separate, non-exposed schema. Admins read it through a dedicated view.
- Ship logs off-platform (Vercel log drain) for retention and tamper resistance.

**Success Criteria:**
- [ ] UPDATE or DELETE on ledger_entries fails
- [ ] Customers and support can't read or alter audit tables
- [ ] Simulation reset keeps the audit history

**Status:** Applied
