/**
 * Accounts and transactions: account switcher, details, and a searchable / filterable ledger.
 * Filters live in the URL (GET form) and are validated server-side with zod enums before reaching the
 * query builder (T38, T42); React renders every value as text (T37). Keyset pagination, max 50 rows (T2600).
 */
import { SearchX, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { categoryLabel, EmptyState, Money, PageHeader, StatusBadge } from "@/components/app/common";
import { LedgerList } from "@/components/app/ledger-list";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label, NativeSelect } from "@/components/ui/form-controls";
import { formatDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { requirePageRole } from "@/lib/page-auth";
import { cn } from "@/lib/utils";
import { LEDGER_CATEGORIES, LedgerSearch, listAccounts, searchLedger } from "@/services/accounts.service";
import { CopyButton, OpenAccountButton } from "./account-widgets";

export const metadata: Metadata = { title: "Accounts" };

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" && v !== "" ? v : undefined);

export default async function AccountsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, supabase } = await requirePageRole(["customer"]);
  const sp = await searchParams;
  const accounts = await listAccounts(supabase, user.id);
  if (accounts.length === 0) {
    return (<><PageHeader title="Accounts" /><EmptyState icon={Wallet} title="No accounts yet" action={<OpenAccountButton />} /></>);
  }
  const selected = accounts.find((a) => a.id === one(sp.account)) ?? accounts[0]!;

  // Validate filters; anything invalid is dropped rather than passed through.
  const raw = { accountId: selected.id, text: one(sp.q), direction: one(sp.direction), category: one(sp.category), from: one(sp.from), to: one(sp.to), cursor: one(sp.cursor), limit: 25 };
  const parsed = LedgerSearch.safeParse(raw);
  const filters = parsed.success ? parsed.data : { accountId: selected.id, limit: 25 };
  const { entries, nextCursor } = await searchLedger(supabase, user.id, filters);
  const filtered = Boolean(raw.text || raw.direction || raw.category || raw.from || raw.to);

  const qs = (extra: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const base: Record<string, string | undefined> = { account: selected.id, q: raw.text, direction: raw.direction, category: raw.category, from: raw.from, to: raw.to, ...extra };
    for (const [k, v] of Object.entries(base)) if (v) p.set(k, v);
    return `/accounts?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Balances and every debit and credit on your accounts."
        actions={<><RealtimeRefresher channel="accounts" tables={["ledger_entries", "transfers"]} /><OpenAccountButton disabled={accounts.length >= 4} /></>}
      />

      <div className="-mx-1 mb-6 flex gap-3 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Your accounts">
        {accounts.map((a) => (
          <Link
            key={a.id}
            href={`/accounts?account=${a.id}`}
            role="tab"
            aria-selected={a.id === selected.id}
            className={cn("min-w-52 rounded-xl border bg-card p-4 shadow-xs transition-colors", a.id === selected.id ? "border-brand ring-2 ring-brand/20" : "hover:bg-muted/50")}
          >
            <p className="text-sm font-medium">{a.name}</p>
            <p className="tabular mt-1 text-xl font-semibold">{formatMoney(a.balance_cents)}</p>
            <p className="text-xs text-muted-foreground">•••• {a.account_number.slice(-4)}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="order-2 grid content-start gap-4 lg:order-1">
          <form method="get" action="/accounts" className="grid gap-3 rounded-xl border bg-card p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-6" role="search" aria-label="Filter transactions">
            <input type="hidden" name="account" value={selected.id} />
            <div className="grid gap-1.5 sm:col-span-2 lg:col-span-2">
              <Label htmlFor="q">Search</Label>
              <Input id="q" name="q" type="search" defaultValue={raw.text ?? ""} maxLength={100} placeholder="Merchant or reference" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="direction">Type</Label>
              <NativeSelect id="direction" name="direction" defaultValue={raw.direction ?? ""}>
                <option value="">All</option><option value="credit">Money in</option><option value="debit">Money out</option>
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="category">Category</Label>
              <NativeSelect id="category" name="category" defaultValue={raw.category ?? ""}>
                <option value="">All</option>
                {LEDGER_CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              </NativeSelect>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="from">From</Label>
              <Input id="from" name="from" type="date" defaultValue={raw.from ?? ""} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="to">To</Label>
              <Input id="to" name="to" type="date" defaultValue={raw.to ?? ""} />
            </div>
            <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
              <Button type="submit">Apply filters</Button>
              {filtered ? <Button asChild variant="ghost"><Link href={`/accounts?account=${selected.id}`}>Clear</Link></Button> : null}
              {!parsed.success ? <p className="text-sm text-destructive">Some filters were invalid and were ignored.</p> : null}
            </div>
          </form>

          {filtered && raw.text ? <p className="text-sm text-muted-foreground">Results for “<span className="font-medium text-foreground">{raw.text}</span>”</p> : null}
          {entries.length ? (
            <>
              <LedgerList rows={entries} />
              <div className="flex justify-center gap-2">
                {raw.cursor ? <Button asChild variant="ghost"><Link href={qs({ cursor: undefined })}>Back to latest</Link></Button> : null}
                {nextCursor ? <Button asChild variant="outline"><Link href={qs({ cursor: nextCursor })}>Older transactions</Link></Button> : null}
              </div>
            </>
          ) : (
            <EmptyState icon={SearchX} title={filtered ? "No transactions match your filters" : "No transactions yet"} description={filtered ? "Try a different search or clear the filters." : undefined} />
          )}
        </div>

        <Card className="order-1 h-fit lg:order-2">
          <CardHeader><CardTitle>{selected.name}</CardTitle><StatusBadge status={selected.status} /></CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Available balance</p>
              <p className="tabular text-3xl font-semibold text-primary">{formatMoney(selected.balance_cents)}</p>
              {selected.pending_out_cents > 0 ? <p className="text-xs text-muted-foreground">Includes <Money cents={selected.pending_out_cents} /> in pending transfers</p> : null}
            </div>
            <dl className="grid gap-3">
              <div>
                <dt className="text-muted-foreground">Account number</dt>
                <dd className="flex items-center justify-between gap-2 font-mono">{selected.account_number}<CopyButton value={selected.account_number} label="Copy account number" /></dd>
              </div>
              <div><dt className="text-muted-foreground">Type</dt><dd>{selected.kind === "savings" ? "Savings" : "Checking"}</dd></div>
              <div><dt className="text-muted-foreground">Bank</dt><dd>ACME Bank</dd></div>
              <div><dt className="text-muted-foreground">Opened</dt><dd>{formatDate(selected.created_at)}</dd></div>
            </dl>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm"><Link href={`/transfers?from=${selected.id}`}>Transfer</Link></Button>
              <Button asChild size="sm" variant="outline"><Link href={`/statements?account=${selected.id}`}>Statement</Link></Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
