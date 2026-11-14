"use client";

import { useActionState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { StepUpDialog, useStepUpRetry } from "@/components/app/step-up";
import { Input, NativeSelect } from "@/components/ui/form-controls";
import { formatCents } from "@/lib/csv";
import { adminCardAction, recordRestrictionAction, setRoleAction } from "./actions";

export function RestrictionForm({ userId, existing }: { userId: string; existing: string[] }) {
  const [state, action] = useActionState(recordRestrictionAction, null);
  const options = [
    ["marketing_email", "Marketing emails"], ["product_analytics", "Usage analytics"],
    ["staff_bulk_export", "Bulk data exports"], ["all_non_essential", "All non-essential processing"],
  ].filter(([v]) => !existing.includes(v!));
  if (options.length === 0) return <p className="text-sm text-muted-foreground">All restrictions are already in place.</p>;
  return (
    <form action={action} className="grid gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-2">
        <NativeSelect name="activity" aria-label="Processing activity">{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</NativeSelect>
        <SubmitButton variant="outline" pendingText="Saving...">Record</SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function AdminCardForm({ cardId, customerId, status, limitCents }: { cardId: string; customerId: string; status: string; limitCents: number }) {
  const [state, action] = useActionState(adminCardAction, null);
  return (
    <div className="grid gap-2">
      <form action={action} className="flex flex-wrap gap-2">
        <input type="hidden" name="cardId" value={cardId} />
        <input type="hidden" name="customerId" value={customerId} />
        <Input name="limit" inputMode="decimal" defaultValue={formatCents(limitCents)} aria-label="Daily limit (USD)" className="w-28" />
        <SubmitButton name="intent" value="limit" variant="outline" size="sm" className="h-10">Set limit</SubmitButton>
        <SubmitButton name="intent" value={status === "active" ? "block" : "unblock"} variant={status === "active" ? "destructive" : "brand"} size="sm" className="h-10">
          {status === "active" ? "Block" : "Unblock"}
        </SubmitButton>
      </form>
      <FormMessage state={state} />
    </div>
  );
}

export function RoleForm({ userId, role }: { userId: string; role: string }) {
  const [state, action] = useActionState(setRoleAction, null);
  const { formRef, stepUpOpen, setStepUpOpen, retry } = useStepUpRetry(state);
  return (
    <form ref={formRef} action={action} className="grid gap-3">
      <input type="hidden" name="userId" value={userId} />
      <div className="flex gap-2">
        <NativeSelect name="role" defaultValue={role} aria-label="Role">
          <option value="customer">Customer</option><option value="support">Support agent</option><option value="admin">Administrator</option>
        </NativeSelect>
        <SubmitButton variant="outline" pendingText="Saving...">Change role</SubmitButton>
      </div>
      {state && !state.stepUp ? <FormMessage state={state} /> : null}
      <StepUpDialog open={stepUpOpen} onOpenChange={setStepUpOpen} onConfirmed={retry} reason="Changing a user's role requires your password." />
    </form>
  );
}
