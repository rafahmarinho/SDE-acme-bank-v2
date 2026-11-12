---
name: t59-use-standard-libraries-for-cryptography
description: Use only node:crypto, WebCrypto, pgcrypto and Supabase Auth for ACME Bank cryptography; never implement custom algorithms.
---

# T59: Use standard libraries for cryptography

**Category:** CODE_FIX
**SD Elements:** [T59](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T59/)
**Priority:** 8

**Spec Context:**
> "Use versões atuais e estáveis das tecnologias e Supabase para PostgreSQL, login por e-mail e senha"
> Source: specs/PRD.md, paragraph 2

**What the spec implies (naive approach):**
Hand-rolled "encryption" helpers (XOR, custom hashing) for confirmation codes or simulated card numbers, or unmaintained npm crypto packages.

**Secure Implementation Pattern:**
```ts
// Allowed crypto providers
import { webcrypto, createHash, timingSafeEqual } from "node:crypto";   // server
// window.crypto.subtle                                                  // browser
// pgcrypto: digest(), gen_random_uuid()                                 // database
// Supabase Auth                                                         // passwords, JWT
```

**Implementation Guidance:**
- Add an ESLint `no-restricted-imports` rule for deprecated or unknown crypto packages (`crypto-js`, `md5`, `sha1`).
- Compare secrets with `timingSafeEqual`.
- Review new dependencies that do cryptography (see skills/supply-chain/T327).

**Success Criteria:**
- [ ] No custom cryptographic primitives in the repository
- [ ] The lint rule blocks unapproved crypto packages

**Status:** Pending
