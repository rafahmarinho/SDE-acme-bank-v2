---
name: t744-protect-pseudonymized-personal-information
description: When ACME Bank pseudonymizes customer data (e.g. for simulated external integrations or event logs), keep the re-identification mapping separate, access-controlled and server-only.
---

# T744: Protect pseudonymized personal information

**Category:** CODE_FIX
**SD Elements:** [T744](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T744/)
**Priority:** 8

**Spec Context:**
> "com integrações externas simuladas" ... "consultar eventos"
> Source: specs/PRD.md, paragraphs 2 and 5

**What the spec implies (naive approach):**
Sending pseudonymous customer tokens to the simulated card network or payment rail, while the token-to-customer mapping table is readable by every authenticated user.

**Secure Implementation Pattern:**
```sql
create schema if not exists private;                       -- not exposed via PostgREST
create table private.customer_pseudonyms (
  customer_id uuid primary key references public.profiles(id),
  pseudonym uuid not null unique default gen_random_uuid()
);
revoke all on schema private from anon, authenticated;
-- Integrations and event logs only ever see `pseudonym`; re-identification via SECURITY DEFINER fn for admin only.
```

**Implementation Guidance:**
- Have the DPO define which fields get replaced by pseudonyms (PIA).
- Keep the mapping in a non-exposed schema that only the service role can reach.
- Never store extra attributes alongside pseudonyms that would let someone re-identify a customer.

**Success Criteria:**
- [ ] The mapping table can't be reached through the public API
- [ ] Integrations and events use pseudonyms only

**Status:** Pending
