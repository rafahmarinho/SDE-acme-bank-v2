---
name: t2600-control-the-result-set-size-of-queries
description: Paginate and cap ACME Bank transaction search, filters, staff customer lookup and statement exports so queries cannot return unbounded result sets.
---

# T2600: Control the result set size returned by a query

**Category:** CODE_FIX
**SD Elements:** [T2600](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T2600/)
**Priority:** 7

**Spec Context:**
> "Inclua [...] busca, filtros, estados de carregamento" ... "Prepare dados de demonstração com seis clientes e dois meses de movimentações."
> Source: specs/PRD.md, paragraphs 2 and 5

**What the spec implies (naive approach):**
`select *` on `ledger_entries` with no limit for search, or a staff "search customers" box that dumps every profile on an empty query.

**Secure Implementation Pattern:**
```ts
const PAGE_MAX = 50;
const Params = z.object({
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(25),
  cursor: z.string().datetime().optional(),
});
const p = Params.parse(searchParams);
let q = supabase.from("ledger_entries").select("id, booked_at, description, amount_cents", { count: "planned" })
  .eq("account_id", accountId).order("booked_at", { ascending: false }).limit(p.limit);
if (p.cursor) q = q.lt("booked_at", p.cursor);
// Staff lookup: require >= 3 chars and cap at 20 results.
// CSV/PDF export: limit to a statement period (max 12 months) and row cap (e.g. 10k).
```

**Implementation Guidance:**
- Enforce a server-side maximum page size whatever the client asks for.
- Set the Supabase API "max rows" setting (for example 1000) as a backstop.
- Require a minimum query length for staff search, and cap export date ranges.

**Success Criteria:**
- [ ] Every list endpoint has a hard `limit` of 50 or less
- [ ] The PostgREST max rows setting is configured
- [ ] Staff search with an empty query returns nothing

**Status:** Pending
