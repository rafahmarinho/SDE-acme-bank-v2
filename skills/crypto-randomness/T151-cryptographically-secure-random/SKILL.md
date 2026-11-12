---
name: t151-use-cryptographically-secure-random-numbers
description: Use crypto.randomUUID / crypto.getRandomValues (or gen_random_uuid in Postgres) for ACME Bank account numbers, transfer references, confirmation tokens and statement IDs; Math.random only for non-security simulation noise.
---

# T151: Use cryptographically secure random numbers

**Category:** CODE_FIX
**SD Elements:** [T151](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T151/)
**Priority:** 7

**Spec Context:**
> "O cliente deve conseguir abrir uma conta simulada" ... "Inclua uma área para escolher cenários, avançar a simulação"
> Source: specs/PRD.md, paragraphs 3 and 5

**What the spec implies (naive approach):**
Generating account numbers, card tokens, transfer confirmation codes or statement IDs with `Math.random()` or sequential integers, which makes them predictable and enumerable.

**Secure Implementation Pattern:**
```ts
import { randomInt, randomUUID, randomBytes } from "node:crypto";
export const newStatementId = () => randomUUID();
export const newConfirmationToken = () => randomBytes(32).toString("base64url");
export function newAccountNumber() {             // 10 digits + Luhn-style check digit
  const digits = Array.from({ length: 10 }, () => randomInt(0, 10)).join("");
  return digits + checkDigit(digits);
}
```
```sql
-- DB primary keys
id uuid primary key default gen_random_uuid()
```

**Implementation Guidance:**
- Use `node:crypto` server-side and `crypto.getRandomValues` in the browser.
- Use UUID primary keys for every customer-facing object.
- `Math.random` (or a seeded PRNG) is fine only for simulation amounts and timing jitter, never for identifiers or tokens.

**Success Criteria:**
- [ ] No `Math.random()` in identifier or token generation
- [ ] All public IDs are UUIDs or CSPRNG-derived

**Status:** Pending
