"use client";

import { Plus, Trash2 } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { StepUpDialog, useStepUpRetry } from "@/components/app/step-up";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input } from "@/components/ui/form-controls";
import { addBeneficiaryAction, deleteBeneficiaryAction } from "./actions";

export function AddBeneficiary() {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addBeneficiaryAction, null);
  const { formRef, stepUpOpen, setStepUpOpen, retry } = useStepUpRetry(state);
  const fe = state?.fieldErrors ?? {};
  return (
    <>
      <Button variant="brand" onClick={() => setOpen(true)}><Plus aria-hidden />Add beneficiary</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Add a beneficiary" description="Save someone you pay often. You'll confirm your password to add a new payee.">
        {state?.ok ? (
          <div className="grid gap-4">
            <FormMessage state={state} />
            <Button onClick={() => window.location.reload()}>Done</Button>
          </div>
        ) : (
          <form ref={formRef} action={action} className="grid gap-4">
            <Field label="Name" htmlFor="nickname" required error={fe.nickname} hint="How it appears in your list, e.g. “Mom” or “Oakwood Properties”.">
              <Input id="nickname" name="nickname" required maxLength={60} />
            </Field>
            <Field label="Bank" htmlFor="bank_name" required error={fe.bank_name}>
              <Input id="bank_name" name="bank_name" required maxLength={80} placeholder="ACME Bank" />
            </Field>
            <Field label="Account number" htmlFor="account_number" required error={fe.account_number} hint="11 digits. ACME Bank accounts receive money instantly once settled.">
              <Input id="account_number" name="account_number" inputMode="numeric" required maxLength={14} pattern="[0-9 \-]{11,14}" />
            </Field>
            {state && !state.ok && !state.stepUp && Object.keys(fe).length === 0 ? <FormMessage state={state} /> : null}
            <SubmitButton pendingText="Saving...">Save beneficiary</SubmitButton>
          </form>
        )}
      </Dialog>
      <StepUpDialog open={stepUpOpen} onOpenChange={setStepUpOpen} onConfirmed={retry} reason="Adding a new payee requires your password." />
    </>
  );
}

export function DeleteBeneficiary({ id, name }: { id: string; name: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(deleteBeneficiaryAction, null);
  return (
    <>
      <Button variant="ghost" size="icon" aria-label={`Remove ${name}`} onClick={() => setOpen(true)}><Trash2 aria-hidden className="text-muted-foreground" /></Button>
      <Dialog open={open} onOpenChange={setOpen} title={`Remove ${name}?`} description="You can add them again later.">
        <form action={action} className="grid gap-4">
          <input type="hidden" name="id" value={id} />
          <FormMessage state={state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            {!state?.ok ? <SubmitButton variant="destructive" pendingText="Removing...">Remove</SubmitButton> : null}
          </div>
        </form>
      </Dialog>
    </>
  );
}
