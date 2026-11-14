"use client";
/**
 * New transfer: details -> review (fee and total shown BEFORE confirmation) -> confirmation.
 * Nothing is stored in browser storage; the quote lives in component state only (T1468).
 */
import { ArrowRight, CircleAlert, CircleCheck, Clock } from "lucide-react";
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/feedback";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { formatMoney } from "@/lib/money";
import { confirmTransferAction, quoteTransferAction, type Quote } from "./actions";

type Account = { id: string; name: string; account_number: string; balance_cents: number };
type Beneficiary = { id: string; nickname: string; bank_name: string; account_number: string };

type Props = { accounts: Account[]; beneficiaries: Beneficiary[]; defaultFrom?: string };

/** Remounting with a new key is how "New transfer" starts over with fresh action state. */
export function TransferForm(props: Props) {
  const [run, setRun] = useState(0);
  return <TransferFlow key={run} {...props} onRestart={() => setRun((r) => r + 1)} />;
}

function TransferFlow({ accounts, beneficiaries, defaultFrom, onRestart }: Props & { onRestart: () => void }) {
  const [quoteState, quoteAction] = useActionState(quoteTransferAction, null);
  const [confirmState, confirmAction] = useActionState(confirmTransferAction, null);
  const [editing, setEditing] = useState(true);
  const [seenQuote, setSeenQuote] = useState<typeof quoteState>(null);
  const [fields, setFields] = useState({ from: defaultFrom ?? accounts[0]?.id ?? "", destination: "", amount: "", reference: "" });
  const [now, setNow] = useState(() => Date.now());

  if (quoteState !== seenQuote) {
    setSeenQuote(quoteState);
    if (quoteState?.ok) setEditing(false);
  }
  const q: Quote | undefined = !editing && quoteState?.ok ? quoteState.data : undefined;

  useEffect(() => {
    if (!q) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [q]);

  const fromAcc = accounts.find((a) => a.id === fields.from);
  const destLabel = (() => {
    const [kind, id] = fields.destination.split(":");
    if (kind === "own") return accounts.find((a) => a.id === id)?.name ?? "";
    const b = beneficiaries.find((x) => x.id === id);
    return b ? `${b.nickname} · ${b.bank_name}` : "";
  })();
  const external = fields.destination.startsWith("ben:");

  if (confirmState?.ok) {
    return (
      <div className="grid justify-items-center gap-4 py-6 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-success/12 text-success"><CircleCheck aria-hidden className="size-7" /></span>
        <div>
          <h2 className="text-xl font-semibold text-primary">Transfer submitted</h2>
          <p className="mt-1 text-sm text-muted-foreground">{q ? formatMoney(q.amountCents) : ""} to {destLabel}</p>
        </div>
        <Alert variant="warning" className="max-w-md text-left">
          <Clock aria-hidden />
          <AlertTitle>Pending</AlertTitle>
          <AlertDescription>The amount is reserved from your balance and the transfer completes when it settles.</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button asChild variant="outline"><Link href="/transfers?tab=history">See history</Link></Button>
          <Button onClick={onRestart}>New transfer</Button>
        </div>
      </div>
    );
  }

  if (q) {
    const secondsLeft = Math.max(0, Math.floor((Date.parse(q.expiresAt) - now) / 1000));
    const insufficient = q.totalCents > q.availableCents;
    return (
      <div className="grid gap-5">
        <div>
          <h2 className="text-lg font-semibold text-primary">Review your transfer</h2>
          <p className="text-sm text-muted-foreground">Check the details and the fee before you confirm.</p>
        </div>
        <dl className="divide-y rounded-lg border">
          {[
            ["From", `${fromAcc?.name ?? ""} •••• ${fromAcc?.account_number.slice(-4) ?? ""}`],
            ["To", destLabel],
            ...(q.reference ? [["Reference", q.reference]] : []),
            ["Amount", formatMoney(q.amountCents)],
            ["Fee", q.feeCents === 0 ? "Free" : formatMoney(q.feeCents)],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-3 text-sm"><dt className="text-muted-foreground">{k}</dt><dd className="text-right font-medium">{v}</dd></div>
          ))}
          <div className="flex justify-between gap-4 bg-muted/50 px-4 py-3"><dt className="font-medium">Total debited</dt><dd className="tabular text-lg font-semibold text-primary">{formatMoney(q.totalCents)}</dd></div>
        </dl>
        {insufficient ? (
          <Alert variant="destructive">
            <CircleAlert aria-hidden />
            <AlertTitle>Insufficient funds</AlertTitle>
            <AlertDescription>Your available balance is {formatMoney(q.availableCents)}. Lower the amount or add money first.</AlertDescription>
          </Alert>
        ) : null}
        {confirmState && !confirmState.ok ? <FormMessage state={confirmState} /> : null}
        <form action={confirmAction} className="flex flex-wrap items-center justify-between gap-3">
          <input type="hidden" name="quoteId" value={q.quoteId} />
          <input type="hidden" name="signature" value={q.signature} />
          <input type="hidden" name="reference" value={q.reference} />
          <p className="text-xs text-muted-foreground">{secondsLeft > 0 ? `This quote is valid for ${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}` : "This quote expired. Go back to get a new one."}</p>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(true)}>Back</Button>
            <SubmitButton variant="brand" disabled={insufficient || secondsLeft === 0} pendingText="Sending...">Confirm transfer</SubmitButton>
          </div>
        </form>
      </div>
    );
  }

  const fe = quoteState?.fieldErrors ?? {};
  return (
    <form action={quoteAction} className="grid gap-4">
      <Field label="From" htmlFor="fromAccountId" required>
        <NativeSelect id="fromAccountId" name="fromAccountId" value={fields.from} onChange={(e) => setFields({ ...fields, from: e.target.value })}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.account_number.slice(-4)} - {formatMoney(a.balance_cents)}</option>)}
        </NativeSelect>
      </Field>
      <Field label="To" htmlFor="destination" required error={fe.destination}>
        <NativeSelect id="destination" name="destination" required value={fields.destination} onChange={(e) => setFields({ ...fields, destination: e.target.value })} aria-invalid={!!fe.destination}>
          <option value="" disabled>Choose a destination</option>
          {accounts.length > 1 ? (
            <optgroup label="My accounts (free)">
              {accounts.filter((a) => a.id !== fields.from).map((a) => <option key={a.id} value={`own:${a.id}`}>{a.name} •••• {a.account_number.slice(-4)}</option>)}
            </optgroup>
          ) : null}
          {beneficiaries.length ? (
            <optgroup label="Beneficiaries">
              {beneficiaries.map((b) => <option key={b.id} value={`ben:${b.id}`}>{b.nickname} · {b.bank_name} •••• {b.account_number.slice(-4)}</option>)}
            </optgroup>
          ) : null}
        </NativeSelect>
      </Field>
      <p className="-mt-2 text-xs text-muted-foreground">
        Paying someone new? <Link href="/beneficiaries" className="font-medium text-brand hover:underline">Add a beneficiary</Link> first.
      </p>
      <Field label="Amount (USD)" htmlFor="amount" required error={fe.amount} hint={external ? "Fee: 0.2% (min $1.50, max $25.00). Exact fee shown on the next step." : "Transfers between your accounts are free."}>
        <Input id="amount" name="amount" inputMode="decimal" required placeholder="0.00" maxLength={12} value={fields.amount} onChange={(e) => setFields({ ...fields, amount: e.target.value })} aria-invalid={!!fe.amount} />
      </Field>
      <Field label="Reference" htmlFor="reference" hint="Shown on your statement. Up to 140 characters.">
        <Input id="reference" name="reference" maxLength={140} value={fields.reference} onChange={(e) => setFields({ ...fields, reference: e.target.value })} />
      </Field>
      {quoteState && !quoteState.ok && Object.keys(fe).length === 0 ? <FormMessage state={quoteState} /> : null}
      <div><SubmitButton pendingText="Calculating fee...">Review transfer<ArrowRight aria-hidden /></SubmitButton></div>
    </form>
  );
}
