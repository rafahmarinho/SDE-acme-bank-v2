"use client";

import { ArrowLeft, CircleAlert, MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { SubmitButton } from "@/components/app/form-bits";
import { Alert, AlertDescription } from "@/components/ui/feedback";
import { Input, Label } from "@/components/ui/form-controls";
import { forgotPasswordAction, type FormState } from "../actions";

export function ForgotForm({ expired }: { expired: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(forgotPasswordAction, null);
  return (
    <div>
      <Link href="/login" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft aria-hidden className="size-4" /> Back to sign in
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Reset your password</h1>
      <p className="mt-1 text-sm text-muted-foreground">Enter the email you use for ACME Bank and we will send you a reset link.</p>
      {expired && !state ? (
        <Alert variant="warning" className="mt-6">
          <CircleAlert aria-hidden />
          <AlertDescription>That link has expired or was already used. Request a new one below.</AlertDescription>
        </Alert>
      ) : null}
      {state?.ok ? (
        <Alert variant="success" className="mt-6">
          <MailCheck aria-hidden />
          <AlertDescription>{state.message} The link works once and expires in 1 hour.</AlertDescription>
        </Alert>
      ) : (
        <form action={action} className="mt-8 grid gap-5">
          <div className="grid gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" autoComplete="email" required maxLength={254} />
          </div>
          {/* Turnstile widget renders here when Supabase Auth CAPTCHA is enabled in hosted environments. */}
          <SubmitButton size="lg" pendingText="Sending...">Send reset link</SubmitButton>
        </form>
      )}
    </div>
  );
}
