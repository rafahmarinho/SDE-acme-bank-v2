---
name: t604-implement-a-consent-withdrawal-mechanism
description: Add a consent management section to ACME Bank Settings where customers can withdraw each optional consent (e.g. marketing emails, analytics), immediately stopping the related processing.
---

# T604: Implement a consent withdrawal mechanism

**Category:** CODE_FIX
**SD Elements:** [T604](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T604/)
**Priority:** 10

**Spec Context:**
> "Inclua login, recuperação de senha, perfil, configurações" ... "abertura de conta"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
A Settings page with only display preferences. Consent given at account opening can never be revoked.

**Secure Implementation Pattern:**
```sql
create table public.consents (
  user_id uuid references auth.users not null,
  purpose text check (purpose in ('marketing_email','product_analytics','partner_offers')) not null,
  granted boolean not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, purpose)
);
create table public.consent_events (id uuid default gen_random_uuid() primary key,
  user_id uuid not null, purpose text not null, granted boolean not null, at timestamptz default now());
alter table public.consents enable row level security;
create policy own_consents on public.consents using (user_id = auth.uid()) with check (user_id = auth.uid());
```
```tsx
// src/app/(app)/settings/consents.tsx - a shadcn <Switch/> per purpose; onChange -> server action
// that upserts consents + inserts consent_events. Email/analytics services check consents before acting.
```

**Implementation Guidance:**
- Have the privacy officer list the consent purposes, using the PIA (see PROCESS items in SD Elements).
- Show every consent with its current state, and make withdrawing as easy as granting.
- When a consent is withdrawn, stop the matching processing right away (exclude the customer from marketing sends).
- Keep an append-only history of consent events.

**Success Criteria:**
- [ ] Settings lists every optional consent with a toggle
- [ ] Withdrawal is honored by the email and analytics services
- [ ] Consent changes are recorded with timestamps

**Status:** Applied
