---
name: t2598-implement-query-level-access-control
description: Define a role-to-object permission matrix (customer, support, admin, service) and implement it with PostgreSQL grants, RLS policies and column-level restrictions in Supabase.
---

# T2598: Implement query-level access control

**Category:** CODE_FIX
**SD Elements:** [T2598](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T2598/)
**Priority:** 8

**Spec Context:**
> "Tenha perfis de cliente, suporte e administrador." ... "um painel para a equipe do banco"
> Source: specs/PRD.md, paragraphs 3 and 4

**What the spec implies (naive approach):**
A single "staff can see everything" rule. Support agents can then read and modify balances, card limits and personal data far beyond what support needs.

**Secure Implementation Pattern:**
```sql
-- Permission matrix (document in docs/db-access-matrix.md)
-- table            customer(own)   support            admin
-- profiles         R/U(limited)    R (masked cols)    R/U
-- accounts         R               R                  R
-- ledger_entries   R               R                  R (writes via RPC only)
-- cards            R/U(status)     R                  R/U
-- support_tickets  C/R             R/U                R/U
create policy support_read_profiles on public.profiles for select
  using ((auth.jwt()->'app_metadata'->>'role') in ('support','admin'));
-- column-level: hide sensitive columns from support
revoke select (date_of_birth, national_id) on public.profiles from authenticated;
create view public.profiles_support as
  select id, full_name, email, left(phone, 3) || '****' as phone_masked from public.profiles;
```

**Implementation Guidance:**
- Write down the matrix before you write migrations. Get every account type covered: customer, support, admin, service.
- Implement it with RLS (rows), column grants or views (columns), and RPC-only writes for monetary tables.
- Add pgTAP or SQL tests that assert each role's allowed and denied operations.

**Success Criteria:**
- [ ] The access matrix is documented and matches the migrations
- [ ] Support can't update balances, limits or ledger rows
- [ ] SQL tests assert the denials for each role

**Status:** Pending
