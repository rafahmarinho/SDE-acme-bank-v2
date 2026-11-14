"use client";

import { CalendarPlus, X } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { cancelScheduledAction, scheduleAction } from "./actions";

type Account = { id: string; name: string; account_number: string };
type Beneficiary = { id: string; nickname: string; bank_name: string };

type ScheduleProps = { accounts: Account[]; beneficiaries: Beneficiary[]; minDate: string; defaultBeneficiary?: string };

export function ScheduleForm(props: ScheduleProps) {
  const [run, setRun] = useState(0);
  return <ScheduleFlow key={run} {...props} onRestart={() => setRun((r) => r + 1)} />;
}

function ScheduleFlow({ accounts, beneficiaries, minDate, defaultBeneficiary, onRestart }: ScheduleProps & { onRestart: () => void }) {
  const [state, action] = useActionState(scheduleAction, null);
  const [f, setF] = useState({ fromAccountId: accounts[0]?.id ?? "", beneficiaryId: defaultBeneficiary ?? "", amount: "", executeOn: minDate, frequency: "once", reference: "" });
  const [reviewing, setReviewing] = useState(false);
  const [seen, setSeen] = useState<typeof state>(null);
  if (state !== seen) {
    setSeen(state);
    setReviewing(Boolean(state?.ok && !state.message)); // review result has no message; confirm result has one
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => { setF({ ...f, [k]: e.target.value }); setReviewing(false); };

  if (beneficiaries.length === 0) {
    return <p className="text-sm text-muted-foreground">Scheduled payments go to a beneficiary. <Link href="/beneficiaries" className="font-medium text-brand hover:underline">Add one first</Link>.</p>;
  }
  if (state?.ok && state.message) {
    return (
      <div className="grid gap-4">
        <FormMessage state={state} />
        <Button variant="outline" onClick={onRestart}>Schedule another</Button>
      </div>
    );
  }
  const fe = state?.fieldErrors ?? {};
  const ben = beneficiaries.find((b) => b.id === f.beneficiaryId);
  return (
    <form action={action} className="grid gap-4">
      {Object.entries(f).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      <Field label="Pay" htmlFor="sp-ben" required error={fe.beneficiaryId}>
        <NativeSelect id="sp-ben" value={f.beneficiaryId} onChange={set("beneficiaryId")} required>
          <option value="" disabled>Choose a beneficiary</option>
          {beneficiaries.map((b) => <option key={b.id} value={b.id}>{b.nickname} · {b.bank_name}</option>)}
        </NativeSelect>
      </Field>
      <Field label="From" htmlFor="sp-from" required>
        <NativeSelect id="sp-from" value={f.fromAccountId} onChange={set("fromAccountId")}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.account_number.slice(-4)}</option>)}
        </NativeSelect>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Amount (USD)" htmlFor="sp-amount" required error={fe.amount}>
          <Input id="sp-amount" inputMode="decimal" placeholder="0.00" value={f.amount} onChange={set("amount")} required maxLength={12} />
        </Field>
        <Field label="Date" htmlFor="sp-date" required error={fe.executeOn}>
          <Input id="sp-date" type="date" min={minDate} value={f.executeOn} onChange={set("executeOn")} required />
        </Field>
      </div>
      <Field label="Repeat" htmlFor="sp-freq" required>
        <NativeSelect id="sp-freq" value={f.frequency} onChange={set("frequency")}>
          <option value="once">Just once</option>
          <option value="monthly">Every month</option>
        </NativeSelect>
      </Field>
      <Field label="Reference" htmlFor="sp-ref">
        <Input id="sp-ref" value={f.reference} onChange={set("reference")} maxLength={140} placeholder="e.g. Rent" />
      </Field>

      {reviewing && state?.data ? (
        <div className="rounded-lg border bg-muted/40 p-4 text-sm">
          <p className="font-medium">Review</p>
          <dl className="mt-2 grid gap-1.5">
            <div className="flex justify-between"><dt className="text-muted-foreground">Pay {ben?.nickname}</dt><dd>{formatMoney(state.data.amountCents)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Fee per payment</dt><dd>{formatMoney(state.data.feeCents)}</dd></div>
            <div className="flex justify-between font-semibold"><dt>Total per payment</dt><dd>{formatMoney(state.data.amountCents + state.data.feeCents)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt>{f.frequency === "monthly" ? "First payment" : "On"}</dt><dd>{f.executeOn ? formatDate(f.executeOn) : ""}</dd></div>
          </dl>
          <p className="mt-2 text-xs text-muted-foreground">If the balance is too low on the day, the payment fails and nothing is charged.</p>
        </div>
      ) : null}
      {state && !state.ok && Object.keys(fe).length === 0 ? <FormMessage state={state} /> : null}
      <div className="flex gap-2">
        {reviewing ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setReviewing(false)}>Edit</Button>
            <SubmitButton name="intent" value="confirm" variant="brand" pendingText="Scheduling..."><CalendarPlus aria-hidden />Confirm schedule</SubmitButton>
          </>
        ) : (
          <SubmitButton name="intent" value="review" pendingText="Checking...">Review</SubmitButton>
        )}
      </div>
    </form>
  );
}

export function CancelScheduled({ id, label }: { id: string; label: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(cancelScheduledAction, null);
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)} aria-label={`Cancel ${label}`}><X aria-hidden />Cancel</Button>
      <Dialog open={open} onOpenChange={setOpen} title="Cancel this payment?" description={label}>
        <form action={action} className="grid gap-4">
          <input type="hidden" name="id" value={id} />
          <FormMessage state={state} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Keep it</Button>
            {!state?.ok ? <SubmitButton variant="destructive" pendingText="Cancelling...">Cancel payment</SubmitButton> : null}
          </div>
        </form>
      </Dialog>
    </>
  );
}
