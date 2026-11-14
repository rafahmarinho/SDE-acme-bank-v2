"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { useActionState, useState } from "react";
import { FormMessage, SubmitButton } from "@/components/app/form-bits";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/form-controls";
import { cn } from "@/lib/utils";
import { generateStatementAction } from "./actions";

type Preset = { key: string; label: string; start: string; end: string };

export function StatementForm({ accounts, presets, defaultAccount }: { accounts: Array<{ id: string; name: string; account_number: string }>; presets: Preset[]; defaultAccount?: string }) {
  const [state, action] = useActionState(generateStatementAction, null);
  const [preset, setPreset] = useState(presets[0]!.key);
  const [range, setRange] = useState({ start: presets[0]!.start, end: presets[0]!.end });
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const choose = (p: Preset) => { setPreset(p.key); setRange({ start: p.start, end: p.end }); };

  return (
    <form action={action} className="grid gap-4">
      <Field label="Account" htmlFor="accountId" required>
        <NativeSelect id="accountId" name="accountId" defaultValue={defaultAccount ?? accounts[0]?.id}>
          {accounts.map((a) => <option key={a.id} value={a.id}>{a.name} •••• {a.account_number.slice(-4)}</option>)}
        </NativeSelect>
      </Field>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">Period</legend>
        <div className="flex flex-wrap gap-2">
          {presets.map((p) => (
            <button key={p.key} type="button" onClick={() => choose(p)} aria-pressed={preset === p.key}
              className={cn("cursor-pointer rounded-full border px-3 py-1 text-sm", preset === p.key ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
              {p.label}
            </button>
          ))}
          <button type="button" onClick={() => setPreset("custom")} aria-pressed={preset === "custom"}
            className={cn("cursor-pointer rounded-full border px-3 py-1 text-sm", preset === "custom" ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>Custom</button>
        </div>
        <div className={cn("grid gap-3 sm:grid-cols-2", preset !== "custom" && "sr-only")}>
          <Field label="From" htmlFor="periodStart" required>
            <Input id="periodStart" name="periodStart" type="date" value={range.start} onChange={(e) => setRange({ ...range, start: e.target.value })} required />
          </Field>
          <Field label="To" htmlFor="periodEnd" required>
            <Input id="periodEnd" name="periodEnd" type="date" value={range.end} onChange={(e) => setRange({ ...range, end: e.target.value })} required />
          </Field>
        </div>
      </fieldset>
      <fieldset className="grid gap-2">
        <legend className="mb-1.5 text-sm font-medium">Format</legend>
        <input type="hidden" name="format" value={format} />
        <div className="grid grid-cols-2 gap-2">
          {([["pdf", "PDF", "Printable statement", FileText], ["csv", "CSV", "For spreadsheets", FileSpreadsheet]] as const).map(([v, label, hint, Icon]) => (
            <button key={v} type="button" onClick={() => setFormat(v)} aria-pressed={format === v}
              className={cn("flex cursor-pointer items-center gap-3 rounded-lg border bg-card p-3 text-left", format === v && "border-brand ring-2 ring-brand/20")}>
              <Icon aria-hidden className="size-5 text-brand" />
              <span><span className="block text-sm font-medium">{label}</span><span className="text-xs text-muted-foreground">{hint}</span></span>
            </button>
          ))}
        </div>
      </fieldset>
      {state?.ok && state.data ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-success/30 bg-success/8 p-3 text-sm">
          <span>Your {state.data.format.toUpperCase()} statement is ready.</span>
          <Button asChild size="sm"><a href={`/api/statements/${state.data.statementId}`}><Download aria-hidden />Download</a></Button>
        </div>
      ) : (
        <FormMessage state={state} />
      )}
      <div><SubmitButton pendingText="Generating...">Generate statement</SubmitButton></div>
    </form>
  );
}
