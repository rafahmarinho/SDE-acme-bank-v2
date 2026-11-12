---
name: t544-anonymize-identifying-info-for-secondary-use
description: Anonymize ACME Bank customer data before secondary uses such as simulation event analysis, staff dashboards aggregates, demo datasets and exported test fixtures.
---

# T544: Anonymize (de-identify) identifying information before using it for a secondary purpose

**Category:** CODE_FIX
**SD Elements:** [T544](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T544/)
**Priority:** 8

**Spec Context:**
> "Prepare dados de demonstração com seis clientes e dois meses de movimentações. Inclua uma área para [...] consultar eventos"
> Source: specs/PRD.md, paragraph 5

**What the spec implies (naive approach):**
Building demo seeds or simulation event views from copies of real customer records, or showing full names and addresses in aggregate dashboards and event logs.

**Secure Implementation Pattern:**
```sql
-- Aggregates for staff dashboards: no direct identifiers
create view public.staff_activity_daily as
  select date_trunc('day', booked_at) as day, direction, count(*) as n, sum(amount_cents) as total_cents
  from public.ledger_entries group by 1, 2;
-- Simulation events store actor as opaque uuid, not name/email
```
```ts
// supabase/seed: generate fictional customers (faker with fixed seed), never import production data
faker.seed(42); const customers = Array.from({ length: 6 }, () => ({ full_name: faker.person.fullName(), ... }));
```

**Implementation Guidance:**
- Demo data must be fully synthetic, which matches the PRD's "seis clientes".
- Dashboards and analytics read aggregated or pseudonymous views only.
- Strip names, emails, addresses and dates of birth from event payloads. Reference customers by UUID.

**Success Criteria:**
- [ ] Seeds contain only synthetic data
- [ ] Event logs and aggregates contain no direct identifiers

**Status:** Applied
