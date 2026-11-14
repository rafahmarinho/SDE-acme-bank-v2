"use client";

import { Check, Copy, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { openAccountAction } from "./actions";

export function OpenAccountButton({ disabled }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(openAccountAction, null);
  const router = useRouter();
  const createdId = state?.ok ? state.data?.id : undefined;
  useEffect(() => {
    if (createdId) router.push(`/accounts?account=${createdId}`);
  }, [createdId, router]);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} disabled={disabled} title={disabled ? "You can have up to 4 accounts" : undefined}>
        <Plus aria-hidden />Open account
      </Button>
      <Dialog open={open && !createdId} onOpenChange={setOpen} title="Open a new account" description="Free to open, no minimum balance. It's ready instantly.">
        <form action={action} className="grid gap-4">
          <Field label="Account type" htmlFor="kind" required>
            <NativeSelect id="kind" name="kind" defaultValue="savings">
              <option value="savings">Savings</option>
              <option value="checking">Checking</option>
            </NativeSelect>
          </Field>
          <Field label="Account name" htmlFor="name" required error={state?.fieldErrors?.name} hint="For example: Holiday fund">
            <Input id="name" name="name" required maxLength={40} defaultValue="Savings" />
          </Field>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <SubmitButton variant="brand" pendingText="Opening...">Open account</SubmitButton>
        </form>
      </Dialog>
    </>
  );
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-label={label}
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
