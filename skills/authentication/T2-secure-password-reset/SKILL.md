---
name: t2-secure-the-password-reset-mechanism
description: Secure the forgot-password and reset-password flow (anti-automation, non-enumerating responses, single-use expiring links, session revocation) for ACME Bank's Supabase email+password auth.
---

# T2: Secure the password reset mechanism

**Category:** CODE_FIX
**SD Elements:** [T2](https://sde-ent-echo.sdelab.net/bunits/afrika-sc-labs/acme-bank-v2/acme-bank-v2/tasks/phase/requirements/31-T2/)
**Priority:** 9

**Spec Context:**
> "Supabase para PostgreSQL, login por e-mail e senha [...] Inclua login, recuperação de senha, perfil, configurações"
> Source: specs/PRD.md, paragraph 2

**What the spec implies (naive approach):**
A "forgot password" form that tells the user when no account matches the email, calls `resetPasswordForEmail` with no rate limit, and accepts any recovery link indefinitely. Existing sessions stay alive after the reset.

**Secure Implementation Pattern:**
```ts
// src/app/(auth)/forgot-password/actions.ts
"use server";
import { z } from "zod";
import { createServerClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

const Schema = z.object({ email: z.string().email().max(254), captchaToken: z.string().min(1) });
const GENERIC = { ok: true, message: "If an account exists, we sent password reset instructions." };

export async function requestReset(form: FormData) {
  const input = Schema.safeParse(Object.fromEntries(form));
  if (!input.success) return GENERIC;                       // same response either way
  await rateLimit(`reset:${input.data.email.toLowerCase()}`, { max: 3, windowSec: 3600 });
  const supabase = await createServerClient();
  await supabase.auth.resetPasswordForEmail(input.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/reset-password`,
    captchaToken: input.data.captchaToken,
  });
  return GENERIC;
}

// src/app/(auth)/reset-password/actions.ts
export async function setNewPassword(password: string) {
  const supabase = await createServerClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, message: "Unable to reset password." };
  await supabase.auth.signOut({ scope: "others" });       // revoke other sessions
  return { ok: true };
}
```

**Implementation Guidance:**
- Return the same confirmation whether or not the email exists, so the form can't be used to enumerate accounts.
- Enable Supabase Auth CAPTCHA (hCaptcha or Turnstile) and pass `captchaToken`. Add app-level rate limiting per email and per IP.
- Make recovery links single-use and short-lived (email OTP expiry of 1 hour or less).
- Allow-list `redirectTo` to the site URL in Supabase Auth's URL configuration.
- Apply the sign-up password policy on reset (minimum 12 characters, plus a leaked-password check if available).
- After a reset, revoke other sessions and email a "your password was changed" notice.

**Success Criteria:**
- [ ] The forgot-password response is identical for existing and unknown emails
- [ ] Reset requests are rate limited and CAPTCHA-protected
- [ ] Recovery links expire and can't be reused
- [ ] Other sessions are revoked after a successful reset

**Status:** Pending
