"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Input, Label } from "@/components/ui/form-controls";
import { resetPasswordAction, type FormState } from "../actions";

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, null);
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Choose a new password</h1>
      <p className="mt-1 text-sm text-muted-foreground">You will be signed out on every other device.</p>
      <form action={action} className="mt-8 grid gap-5">
        <div className="grid gap-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
          <p className="text-xs text-muted-foreground">At least 12 characters with upper- and lowercase letters and a digit.</p>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="confirm">Confirm new password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
        </div>
        {state && !state.ok ? <FormMessage state={state} /> : null}
        <SubmitButton size="lg" pendingText="Updating...">Update password</SubmitButton>
      </form>
    </div>
  );
}
