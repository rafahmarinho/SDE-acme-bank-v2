"use client";

import { Lock, LockOpen } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { StepUpDialog, useStepUpRetry } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form-controls";
import { formatCents } from "@/lib/csv";
import { setCardLimitAction, setCardStatusAction } from "./actions";

export function CardStatusControl({ cardId, status }: { cardId: string; status: "active" | "blocked" }) {
  const [state, action] = useActionState(setCardStatusAction, null);
  const { formRef, stepUpOpen, setStepUpOpen, retry } = useStepUpRetry(state);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const blocking = status === "active";
  return (
    <div className="grid gap-3">
      <form ref={formRef} action={action}>
        <input type="hidden" name="cardId" value={cardId} />
        <input type="hidden" name="status" value={blocking ? "blocked" : "active"} />
        {blocking ? (
          <Button type="button" variant="destructive" className="w-full" onClick={() => setConfirmOpen(true)}><Lock aria-hidden />Block card</Button>
        ) : (
          <SubmitButton variant="brand" className="w-full" pendingText="Unblocking..."><LockOpen aria-hidden />Unblock card</SubmitButton>
        )}
      </form>
      {state && !state.stepUp ? <FormMessage state={state} /> : null}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen} title="Block this card?" description="Purchases and withdrawals will be declined right away. You can unblock it later.">
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="destructive" onClick={() => { setConfirmOpen(false); formRef.current?.requestSubmit(); }}>Block card</Button>
        </div>
      </Dialog>
      <StepUpDialog open={stepUpOpen} onOpenChange={setStepUpOpen} onConfirmed={retry} reason="Unblocking a card requires your password." />
    </div>
  );
}

export function CardLimitControl({ cardId, limitCents }: { cardId: string; limitCents: number }) {
  const [state, action] = useActionState(setCardLimitAction, null);
  const { formRef, stepUpOpen, setStepUpOpen, retry } = useStepUpRetry(state);
  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="cardId" value={cardId} />
      <Field label="Daily spending limit (USD)" htmlFor={`limit-${cardId}`} required error={state?.fieldErrors?.limit} hint="Up to $10,000. Raising the limit asks for your password.">
        <div className="flex gap-2">
          <Input id={`limit-${cardId}`} name="limit" inputMode="decimal" defaultValue={formatCents(limitCents)} maxLength={10} required />
          <SubmitButton variant="outline" pendingText="Saving...">Save</SubmitButton>
        </div>
      </Field>
      {state && !state.stepUp && !state.fieldErrors ? <FormMessage state={state} /> : null}
      <StepUpDialog open={stepUpOpen} onOpenChange={setStepUpOpen} onConfirmed={retry} reason="Raising your card limit requires your password." />
    </form>
  );
}
