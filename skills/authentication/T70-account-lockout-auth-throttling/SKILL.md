---
name: t70-account-lockout-or-authentication-throttling
description: Throttle and progressively delay repeated failed logins for ACME Bank customer, support and administrator accounts to stop brute-force attacks.
---

# T70: Implement account lockout or authentication throttling for system accounts

**Category:** CODE_FIX
**SD Elements:** [T70](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T70/)
**Priority:** 8

**Spec Context:**
> "login por e-mail e senha" ... "Tenha perfis de cliente, suporte e administrador."
> Source: specs/PRD.md, paragraphs 2 and 4

**What the spec implies (naive approach):**
A login form that calls `signInWithPassword` straight from the browser with unlimited attempts. Staff and admin accounts can then be brute-forced.

**Secure Implementation Pattern:**
```ts
// src/services/auth.service.ts (server-only)
import "server-only";
const GENERIC_FAILURE = { ok: false, message: "Invalid email or password." };

export async function login(email: string, password: string, ip: string) {
  const key = `login:${email.toLowerCase()}`;
  const { count, lastFailureAt } = await authAttempts.get(key, ip);   // table or KV store
  if (count >= 5) {
    const waitSec = Math.min(30 * 2 ** (count - 5), 24 * 3600);       // exponential backoff
    if (Date.now() - lastFailureAt < waitSec * 1000) return GENERIC_FAILURE;
  }
  const supabase = await createServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { await authAttempts.recordFailure(key, ip); return GENERIC_FAILURE; }
  await authAttempts.reset(key);
  return { ok: true };
}
```

**Implementation Guidance:**
- Send logins through a server action or route handler so nobody can skip throttling by calling Supabase directly. Also tighten the Supabase Auth rate limits.
- Track failures per account and per IP. Use exponential backoff instead of a permanent lockout.
- Use stricter thresholds for support and administrator roles, and alert on repeated failures.
- Use a generic error message. Log failed attempts to the audit log, never with the password.

**Success Criteria:**
- [ ] 5 or more consecutive failures trigger an increasing delay
- [ ] Throttling applies per account and per IP
- [ ] The error message doesn't reveal whether the email exists
- [ ] Failed attempts are recorded in the audit log

**Status:** Applied
