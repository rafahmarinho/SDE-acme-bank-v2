"use client";
/**
 * Three-step simulated account opening. The consent step is separate and unbundled (T178):
 * each purpose has its own checkbox, required ones are marked, optional ones start unchecked.
 * All steps belong to one form, so the server validates everything again on submit.
 */
import { ArrowLeft, ArrowRight, Check, Info } from "lucide-react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/feedback";
import { Field, Input } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { openAccountAction, type OpenAccountState } from "./actions";

const STEPS = ["Your details", "Security", "Consent"] as const;
const STEP_OF_FIELD: Record<string, number> = {
  full_name: 0, email: 0, phone: 0, address_line1: 0, city: 0, postal_code: 0, password: 1, terms: 2, privacy_notice: 2,
};

export function OpenAccountForm() {
  const [state, action] = useActionState<OpenAccountState, FormData>(openAccountAction, null);
  const [chosenStep, setStep] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const fe = state?.fieldErrors ?? {};
  const errorStep = Object.keys(fe).map((k) => STEP_OF_FIELD[k] ?? 2).sort()[0];
  const [seenState, setSeenState] = useState<OpenAccountState>(null);
  if (state !== seenState) {
    setSeenState(state);
    if (errorStep !== undefined) setStep(errorStep); // jump to the first step with an error
  }
  const step = chosenStep;

  const next = () => {
    const panel = formRef.current?.querySelector<HTMLElement>(`[data-step="${step}"]`);
    const invalid = panel ? [...panel.querySelectorAll<HTMLInputElement>("input")].find((i) => !i.checkValidity()) : undefined;
    if (invalid) return invalid.reportValidity();
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Open your ACME Bank account</h1>
      <p className="mt-1 text-sm text-muted-foreground">It takes about two minutes. This is a simulated account - no real money is involved.</p>

      <ol className="mt-6 grid grid-cols-3 gap-2" aria-label="Progress">
        {STEPS.map((label, i) => (
          <li key={label} className="grid gap-1.5" aria-current={i === step ? "step" : undefined}>
            <span className={cn("h-1.5 rounded-full bg-muted", i <= step && "bg-brand")} />
            <span className={cn("flex items-center gap-1 text-xs text-muted-foreground", i === step && "font-medium text-foreground")}>
              {i < step ? <Check aria-hidden className="size-3 text-brand" /> : null}{label}
            </span>
          </li>
        ))}
      </ol>

      <form ref={formRef} action={action} className="mt-6 grid gap-5" noValidate={false}>
        <fieldset data-step={0} className={cn("grid gap-4", step !== 0 && "hidden")}>
          <legend className="sr-only">Your details</legend>
          <p className="flex gap-2 text-sm text-muted-foreground"><Info aria-hidden className="mt-0.5 size-4 shrink-0" />We use these details to open and operate your account and to contact you about it.</p>
          <Field label="Full name" htmlFor="full_name" required error={fe.full_name}>
            <Input id="full_name" name="full_name" required minLength={2} maxLength={120} autoComplete="name" aria-invalid={!!fe.full_name} />
          </Field>
          <Field label="Email" htmlFor="email" required error={fe.email} hint="You will use it to sign in.">
            <Input id="email" name="email" type="email" required maxLength={254} autoComplete="email" aria-invalid={!!fe.email} />
          </Field>
          <Field label="Mobile phone" htmlFor="phone" required error={fe.phone} hint="For security notices about your account.">
            <Input id="phone" name="phone" type="tel" required maxLength={20} pattern="\+?[0-9 ()\-]{7,20}" autoComplete="tel" placeholder="+1 555 0100" aria-invalid={!!fe.phone} />
          </Field>
          <Field label="Street address" htmlFor="address_line1" required error={fe.address_line1}>
            <Input id="address_line1" name="address_line1" required maxLength={200} autoComplete="address-line1" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="City" htmlFor="city" required error={fe.city}>
              <Input id="city" name="city" required maxLength={100} autoComplete="address-level2" />
            </Field>
            <Field label="Postal code" htmlFor="postal_code" required error={fe.postal_code}>
              <Input id="postal_code" name="postal_code" required maxLength={20} autoComplete="postal-code" />
            </Field>
          </div>
        </fieldset>

        <fieldset data-step={1} className={cn("grid gap-4", step !== 1 && "hidden")}>
          <legend className="sr-only">Security</legend>
          <Field label="Password" htmlFor="password" required error={fe.password} hint="At least 12 characters with upper- and lowercase letters and a digit.">
            <Input id="password" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" aria-invalid={!!fe.password} />
          </Field>
        </fieldset>

        <fieldset data-step={2} className={cn("grid gap-4", step !== 2 && "hidden")}>
          <legend className="text-sm font-medium">Your choices</legend>
          <p className="text-sm text-muted-foreground">Each choice is separate. Optional ones are off unless you turn them on, and you can change them any time in Settings.</p>
          <ConsentRow name="terms" required error={fe.terms}>
            I agree to the <Link href="/legal/terms" target="_blank" className="font-medium text-brand underline-offset-2 hover:underline">Terms of Service</Link>.
          </ConsentRow>
          <ConsentRow name="privacy_notice" required error={fe.privacy_notice}>
            I have read the <Link href="/legal/privacy" target="_blank" className="font-medium text-brand underline-offset-2 hover:underline">Privacy Notice</Link>, which explains how my data is used to run my account.
          </ConsentRow>
          <ConsentRow name="marketing_email">Send me product news and offers by email.</ConsentRow>
          <ConsentRow name="product_analytics">Use my app usage data (never my transactions) to improve ACME Bank.</ConsentRow>
        </fieldset>

        {state && !state.ok && Object.keys(fe).length === 0 ? <FormMessage state={state} /> : null}
        {Object.keys(fe).length > 0 ? (
          <Alert variant="destructive"><AlertDescription>Please check the highlighted fields.</AlertDescription></Alert>
        ) : null}

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="ghost" onClick={() => setStep((s) => s - 1)}><ArrowLeft aria-hidden />Back</Button>
          ) : (
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">I already have an account</Link>
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" onClick={next}>Continue<ArrowRight aria-hidden /></Button>
          ) : (
            <SubmitButton variant="brand" pendingText="Opening your account...">Open account</SubmitButton>
          )}
        </div>
      </form>
    </div>
  );
}

function ConsentRow({ name, required, error, children }: { name: string; required?: boolean; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <label className="flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 text-sm has-[:checked]:border-brand/50 has-[:checked]:bg-accent/40">
        <input type="checkbox" name={name} required={required} className="mt-0.5 size-4 shrink-0 accent-[var(--brand)]" />
        <span>
          {children}{" "}
          <span className={cn("text-xs", required ? "font-medium text-brand" : "text-muted-foreground")}>{required ? "Required" : "Optional"}</span>
        </span>
      </label>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
