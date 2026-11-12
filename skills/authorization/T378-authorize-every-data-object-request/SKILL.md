---
name: t378-authorize-every-request-for-data-objects
description: Prevent IDOR on ACME Bank accounts, transfers, beneficiaries, cards and statements by checking object ownership server-side and in PostgreSQL RLS using the session user ID.
---

# T378: Authorize every request for data objects

**Category:** CODE_FIX
**SD Elements:** [T378](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/development/31-T378/)
**Priority:** 8

**Spec Context:**
> "O cliente deve conseguir abrir uma conta simulada, consultar saldo, transferir dinheiro, agendar pagamentos, bloquear o cartão e alterar limites."
> Source: specs/PRD.md, paragraph 3

**What the spec implies (naive approach):**
Endpoints such as `/api/cards/[cardId]` or `/api/statements/[statementId]` load rows by the ID in the URL, so changing the ID exposes another customer's card or statement.

**Secure Implementation Pattern:**
```sql
-- supabase/migrations/0002_rls_ownership.sql
alter table public.cards enable row level security;
create policy "owner can read own cards" on public.cards
  for select using (customer_id = auth.uid());
create policy "owner can update own cards" on public.cards
  for update using (customer_id = auth.uid()) with check (customer_id = auth.uid());
create policy "support can read cards" on public.cards
  for select using ((auth.jwt() -> 'app_metadata' ->> 'role') in ('support','admin'));
```
```ts
// src/app/api/cards/[cardId]/route.ts
const { user, supabase } = await authorize("cards/:id", "PATCH");
const { data: card } = await supabase.from("cards")
  .select("id, status").eq("id", params.cardId).eq("customer_id", user.id).single();
if (!card) return new Response("Not found", { status: 404 });   // same for "not yours"
```

**Implementation Guidance:**
- Take ownership from `auth.uid()` or the session user, never from a request parameter.
- Enable RLS on every table that holds customer data (accounts, ledger_entries, transfers, beneficiaries, scheduled_payments, cards, statements, support_tickets).
- Return 404 for objects the user isn't allowed to see, so their existence doesn't leak.
- Make sure any service-role code paths (simulation, settlement jobs) never take a user-chosen object ID without checking it.

**Success Criteria:**
- [ ] RLS is enabled with ownership policies on all customer tables
- [ ] Cross-customer ID tampering tests return 404
- [ ] No route uses the service-role client for user-initiated reads

**Status:** Pending
