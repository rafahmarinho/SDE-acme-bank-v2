"use client";

import { useActionState, useOptimistic, useTransition } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Field, Input } from "@/components/ui/form-controls";
import { Switch } from "@/components/ui/switch";
import { changePasswordAction, setConsentAction, signOutOthersAction } from "./actions";

export function ConsentToggle({ purpose, label, description, granted }: { purpose: string; label: string; description: string; granted: boolean }) {
  const [pending, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(granted);
  const id = `consent-${purpose}`;
  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        id={id}
        checked={optimistic}
        disabled={pending}
        aria-describedby={`${id}-state`}
        onCheckedChange={(next) => {
          start(async () => {
            setOptimistic(next);
            const fd = new FormData();
            fd.set("purpose", purpose);
            fd.set("granted", String(next));
            await setConsentAction(fd);
          });
        }}
      />
      <span id={`${id}-state`} className="sr-only">{optimistic ? "On" : "Off"}</span>
    </div>
  );
}

export function ChangePasswordForm() {
  const [state, action] = useActionState(changePasswordAction, null);
  return (
    <form action={action} className="grid max-w-md gap-4">
      <Field label="Current password" htmlFor="current" required>
        <Input id="current" name="current" type="password" autoComplete="current-password" required maxLength={128} />
      </Field>
      <Field label="New password" htmlFor="password" required hint="At least 12 characters with upper- and lowercase letters and a digit.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      </Field>
      <Field label="Confirm new password" htmlFor="confirm" required>
        <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required minLength={12} maxLength={128} />
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Updating...">Update password</SubmitButton></div>
    </form>
  );
}

export function SignOutOthersForm() {
  const [state, action] = useActionState(signOutOthersAction, null);
  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      <div><SubmitButton variant="outline" pendingText="Signing out...">Sign out other devices</SubmitButton></div>
    </form>
  );
}
