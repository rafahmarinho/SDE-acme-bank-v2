---
name: t60-use-approved-crypto-algorithms-and-key-lengths
description: Use only approved algorithms (AES-256-GCM, SHA-256+, HMAC-SHA-256, bcrypt/argon2 via Supabase Auth) with adequate key lengths for any ACME Bank tokens, signatures or field encryption.
---

# T60: Use correct and approved cryptographic algorithms, parameters, and key lengths

**Category:** CODE_FIX
**SD Elements:** [T60](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T60/)
**Priority:** 8

**Spec Context:**
> "login por e-mail e senha" ... "um histórico de lançamentos de débito e crédito"
> Source: specs/PRD.md, paragraphs 2 and 3

**What the spec implies (naive approach):**
"Protecting" transfer confirmation tokens or exported statements with Base64 or MD5, or signing the ledger chain with SHA-1.

**Secure Implementation Pattern:**
```ts
import { createHmac, createCipheriv, randomBytes } from "node:crypto";
// Integrity of ledger entries / confirmation tokens
export const sign = (data: string, key: Buffer) => createHmac("sha256", key).update(data).digest("base64url");
// Field-level encryption, if needed (e.g. sensitive profile fields)
export function encrypt(plain: string, key: Buffer /* 32 bytes */) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64url");
}
```

**Implementation Guidance:**
- Leave password hashing to Supabase Auth (bcrypt). Never hash passwords yourself.
- Allowed: AES-256-GCM, SHA-256/384/512, HMAC-SHA-256, Ed25519/ECDSA P-256. Forbidden: MD5, SHA-1, DES/3DES, ECB, RC4.
- Keep keys in environment secrets. Document the key-rotation process.

**Success Criteria:**
- [ ] No MD5, SHA-1, DES, ECB or RC4 anywhere in the code
- [ ] Encoding (Base64) is never used as protection

**Status:** Applied
