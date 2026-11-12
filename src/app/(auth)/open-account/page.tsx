/**
 * Simulated account opening with a separate, unbundled consent step.
 * Required fields are marked; optional consents are unchecked by default.
 */
"use client";

import { useActionState } from "react";
import { openAccountAction, type OpenAccountState } from "./actions";

export default function Page() {
  const [state, action, pending] = useActionState<OpenAccountState, FormData>(openAccountAction, null);
  if (state?.ok) return <main className="p-6"><p role="status">{state.message}</p></main>;
  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-2xl font-semibold">Open a simulated ACME Bank account</h1>
      <form action={action} className="mt-6 space-y-4">
        <fieldset>
          <legend className="font-semibold">Your details (required)</legend>
          <p className="text-sm">We use these to open and operate your account.</p>
          <label className="block">Full name *<input name="full_name" required maxLength={120} autoComplete="name" /></label>
          <label className="block">Email *<input name="email" type="email" required maxLength={254} autoComplete="email" /></label>
          <label className="block">Password *<input name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" /></label>
          <label className="block">Phone *<input name="phone" type="tel" required maxLength={20} autoComplete="tel" /></label>
          <label className="block">Address *<input name="address_line1" required maxLength={200} autoComplete="address-line1" /></label>
          <label className="block">City *<input name="city" required maxLength={100} autoComplete="address-level2" /></label>
          <label className="block">Postal code *<input name="postal_code" required maxLength={20} autoComplete="postal-code" /></label>
        </fieldset>

        <fieldset>
          <legend className="font-semibold">Consent</legend>
          <label className="block"><input type="checkbox" name="terms" required /> I agree to the <a href="/legal/terms">Terms of Service</a> (required)</label>
          <label className="block"><input type="checkbox" name="privacy_notice" required /> I have read the <a href="/legal/privacy">Privacy Notice</a> (required)</label>
          <label className="block"><input type="checkbox" name="marketing_email" /> Send me product news by email (optional)</label>
          <label className="block"><input type="checkbox" name="product_analytics" /> Use my usage data to improve the app (optional)</label>
          <p className="text-sm">You can change optional choices at any time in Settings.</p>
        </fieldset>

        {state && !state.ok ? <p role="alert">{state.message}</p> : null}
        <button type="submit" disabled={pending}>Open account</button>
      </form>
    </main>
  );
}
