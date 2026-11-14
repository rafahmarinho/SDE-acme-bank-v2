"use client";

import { FastForward, Play, RotateCcw } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { simulationAction } from "./actions";

type Scenario = { key: string; label: string; description: string };

export function ScenarioForm({ scenarios, customers }: { scenarios: Scenario[]; customers: Array<{ id: string; full_name: string }> }) {
  const [state, action] = useActionState(simulationAction, null);
  const [key, setKey] = useState(scenarios[0]!.key);
  const current = scenarios.find((s) => s.key === key)!;
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="action" value="apply" />
      <Field label="Scenario" htmlFor="scenario" required hint={current.description}>
        <NativeSelect id="scenario" name="scenario" value={key} onChange={(e) => setKey(e.target.value)}>
          {scenarios.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </NativeSelect>
      </Field>
      <Field label="Customers" htmlFor="customerId" required>
        <NativeSelect id="customerId" name="customerId" defaultValue="">
          <option value="">All demo customers</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}
        </NativeSelect>
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton variant="brand" pendingText="Running..."><Play aria-hidden />Run scenario</SubmitButton></div>
    </form>
  );
}

export function AdvanceForm() {
  const [state, action] = useActionState(simulationAction, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="action" value="advance" />
      <Field label="Days to advance" htmlFor="days" required hint="Each day: card activity, payroll on the 1st/15th, due scheduled payments, then settlement of pending transfers. Max 31.">
        <Input id="days" name="days" type="number" min={1} max={31} defaultValue={1} required />
      </Field>
      <FormMessage state={state} />
      <div><SubmitButton pendingText="Advancing..."><FastForward aria-hidden />Advance clock</SubmitButton></div>
    </form>
  );
}

export function ResetForm() {
  const [state, action] = useActionState(simulationAction, null);
  const [open, setOpen] = useState(false);
  return (
    <div className="grid gap-3">
      <Button variant="destructive" onClick={() => setOpen(true)} className="w-fit"><RotateCcw aria-hidden />Reset demo data</Button>
      <FormMessage state={state} />
      <Dialog open={open} onOpenChange={setOpen} title="Reset demo data?" description="Restores the six demo customers to the two-month baseline and the clock to today. Non-demo customers and the audit trail are not touched.">
        <form action={async (fd) => { await action(fd); setOpen(false); }} className="flex justify-end gap-2">
          <input type="hidden" name="action" value="reset" />
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <SubmitButton variant="destructive" pendingText="Resetting...">Reset</SubmitButton>
        </form>
      </Dialog>
    </div>
  );
}
