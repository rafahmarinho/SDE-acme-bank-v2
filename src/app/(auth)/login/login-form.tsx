"use client";

import { useActionState } from "react";
import { loginAction, type FormState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(loginAction, null);
  return (
    <form action={action} className="mt-6 space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <label className="block">
        Email
        <input name="email" type="email" autoComplete="username" required maxLength={254} className="block w-full" />
      </label>
      <label className="block">
        Password
        <input name="password" type="password" autoComplete="current-password" required maxLength={128} className="block w-full" />
      </label>
      {state && !state.ok ? <p role="alert">{state.message}</p> : null}
      <button type="submit" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</button>
      <a href="/forgot-password">Forgot your password?</a>
    </form>
  );
}
