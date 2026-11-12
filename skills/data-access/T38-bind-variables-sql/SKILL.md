---
name: t38-bind-variables-in-sql-statements
description: Prevent SQL injection in ACME Bank's Supabase PostgreSQL access (search/filters, RPC functions, ledger posting) by using parameterized queries and safe query builders only.
---

# T38: Bind variables in SQL statements

**Category:** CODE_FIX
**SD Elements:** [T38](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T38/)
**Priority:** 10

**Spec Context:**
> "Supabase para PostgreSQL" ... "Organize o projeto em telas, componentes, serviços e acesso ao banco. Inclua [...] busca, filtros"
> Source: specs/PRD.md, paragraph 2

**What the spec implies (naive approach):**
Transaction search and filters that build SQL strings, such as `` `... where description ilike '%${q}%'` ``. Other variants are `EXECUTE` with concatenated text inside plpgsql RPC functions, or `.or()` filters assembled from raw user input.

**Secure Implementation Pattern:**
```ts
// src/services/accounts.service.ts - query builder, values bound by PostgREST
const q = SearchSchema.parse(input);                     // zod: string max 100, enum filters
let query = supabase.from("ledger_entries")
  .select("id, booked_at, description, amount_cents, direction")
  .eq("account_id", q.accountId)
  .order("booked_at", { ascending: false })
  .range(q.offset, q.offset + q.limit - 1);
if (q.text) query = query.ilike("description", `%${q.text.replace(/[%_\\]/g, "\\$&")}%`);
if (q.direction) query = query.eq("direction", q.direction);   // enum-validated
```
```sql
-- RPC functions: parameters only; if dynamic SQL is unavoidable use format() with %L / %I
create or replace function public.post_transfer(p_from uuid, p_to uuid, p_amount_cents bigint)
returns uuid language plpgsql security invoker as $$
begin
  insert into ledger_entries(account_id, amount_cents, direction) values (p_from, p_amount_cents, 'debit');
  -- ...
end $$;
```

**Implementation Guidance:**
- Use the supabase-js query builder or RPC parameters. Never interpolate user input into SQL text.
- Never build `.or()` / `.filter()` strings from raw input. Validate against enums first.
- In plpgsql, avoid `EXECUTE`. If it can't be avoided, use `format('%I', ...)` / `%L` or `USING`.
- Escape LIKE wildcards in search terms.

**Success Criteria:**
- [ ] No string-concatenated SQL anywhere in `src/` or `supabase/migrations/`
- [ ] Search and filter inputs are validated with zod
- [ ] Injection test payloads in search return no extra rows and no errors

**Status:** Applied
