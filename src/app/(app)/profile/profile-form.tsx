"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Field, Input } from "@/components/ui/form-controls";
import { updateProfileAction } from "./actions";

type Profile = { full_name: string; email: string; phone: string | null; address_line1: string | null; city: string | null; postal_code: string | null };

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, action] = useActionState(updateProfileAction, null);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <Field label="Full name" htmlFor="full_name" required error={fe.full_name} className="sm:col-span-2">
        <Input id="full_name" name="full_name" defaultValue={profile.full_name} required minLength={2} maxLength={120} autoComplete="name" aria-invalid={!!fe.full_name} />
      </Field>
      <Field label="Email" htmlFor="email" required hint="Your sign-in email. Contact Support to change it." className="sm:col-span-2">
        <Input id="email" value={profile.email} readOnly disabled />
      </Field>
      <Field label="Mobile phone" htmlFor="phone" required error={fe.phone}>
        <Input id="phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} required maxLength={20} autoComplete="tel" aria-invalid={!!fe.phone} />
      </Field>
      <Field label="Street address" htmlFor="address_line1" required error={fe.address_line1}>
        <Input id="address_line1" name="address_line1" defaultValue={profile.address_line1 ?? ""} required maxLength={200} autoComplete="address-line1" />
      </Field>
      <Field label="City" htmlFor="city" required error={fe.city}>
        <Input id="city" name="city" defaultValue={profile.city ?? ""} required maxLength={100} autoComplete="address-level2" />
      </Field>
      <Field label="Postal code" htmlFor="postal_code" required error={fe.postal_code}>
        <Input id="postal_code" name="postal_code" defaultValue={profile.postal_code ?? ""} required maxLength={20} autoComplete="postal-code" />
      </Field>
      <div className="grid gap-3 sm:col-span-2">
        <FormMessage state={state} />
        <div><SubmitButton pendingText="Saving...">Save changes</SubmitButton></div>
      </div>
    </form>
  );
}
