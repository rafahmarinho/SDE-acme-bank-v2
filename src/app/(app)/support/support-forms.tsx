"use client";

import { Send } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Field, Input, NativeSelect, Textarea } from "@/components/ui/form-controls";
import { createTicketAction, replyAction, setTicketStatusAction } from "./actions";

const CATEGORIES = [
  ["general", "General question"], ["card", "Cards"], ["transfer", "Transfers and payments"],
  ["account", "My account"], ["privacy", "Privacy and my data"],
] as const;

export function NewTicketForm({ defaultCategory }: { defaultCategory?: string }) {
  const [state, action] = useActionState(createTicketAction, null);
  const [len, setLen] = useState(0);
  const fe = state?.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-4">
      <Field label="Topic" htmlFor="category" required>
        <NativeSelect id="category" name="category" defaultValue={defaultCategory ?? "general"}>
          {CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Subject" htmlFor="subject" required error={fe.subject}>
        <Input id="subject" name="subject" required minLength={3} maxLength={120} />
      </Field>
      <Field label="How can we help?" htmlFor="body" required error={fe.body} hint={`${len}/2000 · Never share your password or full card number.`}>
        <Textarea id="body" name="body" required minLength={10} maxLength={2000} rows={5} onChange={(e) => setLen(e.target.value.length)} />
      </Field>
      {state && !state.ok && !Object.keys(fe).length ? <FormMessage state={state} /> : null}
      <div><SubmitButton pendingText="Sending...">Send request</SubmitButton></div>
    </form>
  );
}

export function ReplyForm({ ticketId }: { ticketId: string }) {
  const [state, action] = useActionState(async (prev: Awaited<ReturnType<typeof replyAction>>, fd: FormData) => {
    const res = await replyAction(prev, fd);
    if (res?.ok) ref.current?.reset();
    return res;
  }, null);
  const ref = useRef<HTMLFormElement>(null);
  return (
    <form ref={ref} action={action} className="grid gap-3">
      <input type="hidden" name="ticketId" value={ticketId} />
      <label htmlFor="reply" className="sr-only">Your reply</label>
      <Textarea id="reply" name="body" required maxLength={2000} rows={3} placeholder="Write a reply..." />
      {state && !state.ok ? <FormMessage state={state} /> : null}
      <div className="flex justify-end"><SubmitButton pendingText="Sending..."><Send aria-hidden />Send</SubmitButton></div>
    </form>
  );
}

export function TicketStatusButton({ ticketId, next, label }: { ticketId: string; next: "open" | "closed"; label: string }) {
  const [state, action] = useActionState(setTicketStatusAction, null);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="status" value={next} />
      <SubmitButton variant="outline" size="sm" pendingText="Saving...">{label}</SubmitButton>
      {state && !state.ok ? <span className="text-xs text-destructive">{state.message}</span> : null}
    </form>
  );
}
