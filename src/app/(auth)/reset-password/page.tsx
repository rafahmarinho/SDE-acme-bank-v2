/**
 * Reset-password page, reached only via /auth/confirm (single-use, expiring recovery token).
 * Enforces the password policy server-side and revokes other sessions after the change.
 */
"use client";

import { useActionState } from "react";
import { resetPasswordAction, type FormState } from "../actions";

export default function Page() {
  const [state, action, pending] = useActionState<FormState, FormData>(resetPasswordAction, null);
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Choose a new password</h1>
      <form action={action} className="mt-6 space-y-4">
        <label className="block">
          New password
          <input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="block w-full" />
        </label>
        <label className="block">
          Confirm password
          <input name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="block w-full" />
        </label>
        <p className="text-sm">At least 12 characters with upper- and lowercase letters and a digit.</p>
        {state && !state.ok ? <p role="alert">{state.message}</p> : null}
        <button type="submit" disabled={pending}>Update password</button>
      </form>
    </main>
  );
}
