---
name: t2139-prevent-information-exposure-through-apis
description: Return only explicitly selected, schema-validated fields from ACME Bank APIs (no select *, no raw DB rows, no internal errors), especially on staff customer lookups.
---

# T2139: Prevent information exposure through APIs

**Category:** CODE_FIX
**SD Elements:** [T2139](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T2139/)
**Priority:** 7

**Spec Context:**
> "um painel para a equipe do banco" ... "estados de carregamento e mensagens de erro"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
`supabase.from("profiles").select("*")` returned straight to the client, with the UI filtering out sensitive fields. Raw Postgres error messages are shown as the "error messages".

**Secure Implementation Pattern:**
```ts
// src/app/api/staff/customers/route.ts
const CustomerSummary = z.object({
  id: z.string().uuid(), full_name: z.string(), email: z.string().email(),
  phone_masked: z.string(), account_count: z.number(),
});
const { data, error } = await supabase.from("profiles_support")
  .select("id, full_name, email, phone_masked, account_count").ilike("full_name", `${q}%`).limit(20);
if (error) { logger.error({ err: error }, "staff lookup failed"); return json({ error: "Search failed" }, 500); }
return json(z.array(CustomerSummary).parse(data));      // response schema enforced
```

**Implementation Guidance:**
- Name the columns in every `select()` and never use `*` in API-facing queries.
- Validate responses with zod schemas, which strips unknown fields.
- Map database errors to generic user messages and log the details server-side only.
- Delete unused route handlers and server actions before release.

**Success Criteria:**
- [ ] No `select("*")` in API-facing code
- [ ] Every API response passes a schema
- [ ] Error responses contain no SQL, stack traces or internal IDs

**Status:** Applied
