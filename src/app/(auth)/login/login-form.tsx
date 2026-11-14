"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Input, Label } from "@/components/ui/form-controls";
import { loginAction, type FormState } from "../actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);
  return (
    <form action={action} className="mt-8 grid gap-5">
      <input type="hidden" name="next" value={next} />
      <div className="grid gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required maxLength={254} placeholder="you@example.com" />
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link href="/forgot-password" className="text-xs font-medium text-brand hover:underline">Forgot your password?</Link>
        </div>
        <Input id="password" name="password" type="password" autoComplete="current-password" required maxLength={128} />
      </div>
      {state && !state.ok ? <FormMessage state={state} /> : null}
      <SubmitButton size="lg" pendingText="Signing in...">Sign in</SubmitButton>
    </form>
  );
}
