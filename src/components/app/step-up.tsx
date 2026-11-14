"use client";
/**
 * Step-up re-authentication dialog (T338). When a server action answers { stepUp: true }, the form
 * opens this dialog; after the password is confirmed server-side the original form is re-submitted.
 */
import { ShieldCheck } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { stepUpAction } from "@/app/(app)/settings/actions";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form-controls";
import { FormMessage, SubmitButton } from "./form-bits";

export function StepUpDialog({ open, onOpenChange, onConfirmed, reason }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirmed: () => void;
  reason: string;
}) {
  const [state, action] = useActionState(stepUpAction, null);
  const handled = useRef<typeof state>(null);

  useEffect(() => {
    if (state?.ok && handled.current !== state) {
      handled.current = state;
      onOpenChange(false);
      onConfirmed();
    }
  }, [state, onConfirmed, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Confirm it's you" description={reason}>
      <form action={action} className="grid gap-4">
        <Field label="Password" htmlFor="stepup-password" required>
          <Input id="stepup-password" name="password" type="password" autoComplete="current-password" required maxLength={128} autoFocus />
        </Field>
        {state && !state.ok ? <FormMessage state={state} /> : null}
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck aria-hidden className="size-4 text-brand" /> You will not be asked again for 10 minutes.
        </p>
        <SubmitButton pendingText="Verifying...">Confirm</SubmitButton>
      </form>
    </Dialog>
  );
}

/** Hook: wraps a form so a { stepUp: true } result triggers the dialog and an automatic retry. */
export function useStepUpRetry(state: { stepUp?: boolean } | null) {
  const formRef = useRef<HTMLFormElement>(null);
  const [handled, setHandled] = useState<unknown>(null);
  return {
    formRef,
    stepUpOpen: Boolean(state?.stepUp) && handled !== state,
    setStepUpOpen: (open: boolean) => { if (!open) setHandled(state); },
    retry: () => { setHandled(state); formRef.current?.requestSubmit(); },
  };
}
