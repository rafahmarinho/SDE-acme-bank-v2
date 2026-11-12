/**
 * Forgot-password page. Always shows the same confirmation (no account enumeration);
 * requests are rate limited per email and IP, and CAPTCHA-protected when Supabase Auth CAPTCHA is enabled.
 */
"use client";

import { useActionState } from "react";
import { forgotPasswordAction, type FormState } from "../actions";

export default function Page() {
  const [state, action, pending] = useActionState<FormState, FormData>(forgotPasswordAction, null);
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Reset your password</h1>
      {state?.ok ? (
        <p role="status">{state.message}</p>
      ) : (
        <form action={action} className="mt-6 space-y-4">
          <label className="block">
            Email
            <input name="email" type="email" autoComplete="email" required maxLength={254} className="block w-full" />
          </label>
          {/* Turnstile widget renders here when NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured */}
          <button type="submit" disabled={pending}>Send reset link</button>
        </form>
      )}
    </main>
  );
}
