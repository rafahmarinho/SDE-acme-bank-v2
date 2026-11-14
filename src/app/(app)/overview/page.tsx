/**
 * Overview: total balance, accounts, this month's cash flow and spending, recent activity,
 * pending transfers and upcoming scheduled payments. Server-rendered from PostgreSQL on every
 * request (persists across reloads without browser storage - T1468) and refreshed live via Realtime.
 */
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CalendarClock, CreditCard, FileText, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryBars } from "@/components/app/category-bars";
import { EmptyState, Money, PageHeader, StatTile } from "@/components/app/common";
import { LedgerList } from "@/components/app/ledger-list";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatLongDate } from "@/lib/format";
import { formatMoney, maskAccount } from "@/lib/money";
import { requirePageRole } from "@/lib/page-auth";
import { appToday, cashflowSince, listAccounts, recentActivity } from "@/services/accounts.service";
import { listScheduled } from "@/services/scheduled.service";
import { listTransfers } from "@/services/transfers.service";

export const metadata: Metadata = { title: "Overview" };

const QUICK = [
  { href: "/transfers", label: "Transfer", icon: ArrowLeftRight },
  { href: "/scheduled-payments", label: "Schedule", icon: CalendarClock },
  { href: "/cards", label: "Cards", icon: CreditCard },
  { href: "/statements", label: "Statements", icon: FileText },
];

export default async function OverviewPage() {
  const { user, supabase } = await requirePageRole(["customer"]);
  const [accounts, today, profile] = await Promise.all([
    listAccounts(supabase, user.id),
    appToday(supabase),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const ids = accounts.map((a) => a.id);
  const monthStart = `${today.slice(0, 7)}-01`;
  const [recent, flow, pending, upcoming] = await Promise.all([
    recentActivity(supabase, ids, 8),
    cashflowSince(supabase, ids, monthStart),
    listTransfers(supabase, user.id, 5, "pending"),
    listScheduled(supabase, user.id),
  ]);
  const total = accounts.reduce((a, x) => a + x.balance_cents, 0);
  const names = new Map(accounts.map((a) => [a.id, a.name]));
  const firstName = profile.data?.full_name?.split(" ")[0] ?? "there";

  return (
    <>
      <PageHeader
        title={`Hello, ${firstName}`}
        description={formatLongDate(today)}
        actions={<RealtimeRefresher channel="overview" tables={["ledger_entries", "transfers", "scheduled_payments"]} />}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl bg-navy-900 p-6 text-white shadow-sm lg:col-span-2">
          <div aria-hidden className="absolute -top-20 -right-16 size-64 rounded-full bg-brand/25 blur-3xl" />
          <p className="relative text-sm text-white/70">Total balance</p>
          <p className="tabular relative mt-1 text-4xl font-semibold tracking-tight">{formatMoney(total)}</p>
          <p className="relative mt-1 text-xs text-white/60">Across {accounts.length} account{accounts.length === 1 ? "" : "s"} · pending transfers already deducted</p>
          <div className="relative mt-6 grid grid-cols-4 gap-2">
            {QUICK.map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-lg bg-white/8 px-2 py-3 text-xs font-medium transition-colors hover:bg-white/15">
                <span className="grid size-9 place-items-center rounded-full bg-brand text-white"><Icon aria-hidden className="size-4" /></span>
                {label}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid gap-4">
          <StatTile label="Money in this month" value={formatMoney(flow.inCents)} icon={ArrowDownLeft} />
          <StatTile label="Money out this month" value={formatMoney(flow.outCents)} icon={ArrowUpRight} />
        </div>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {accounts.map((a) => (
          <Link key={a.id} href={`/accounts?account=${a.id}`} className="group rounded-xl border bg-card p-5 shadow-xs transition-shadow hover:shadow-md">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium"><Wallet aria-hidden className="size-4 text-brand" />{a.name}</span>
              <span className="text-xs text-muted-foreground">{maskAccount(a.account_number)}</span>
            </div>
            <p className="tabular mt-3 text-2xl font-semibold">{formatMoney(a.balance_cents)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {a.kind === "savings" ? "Savings" : "Checking"}
              {a.pending_out_cents > 0 ? ` · ${formatMoney(a.pending_out_cents)} pending` : ""}
            </p>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader>
            <div><CardTitle>Recent activity</CardTitle><CardDescription>Latest movements across your accounts</CardDescription></div>
            <Button asChild variant="outline" size="sm"><Link href="/accounts">View all</Link></Button>
          </CardHeader>
          <CardContent>
            {recent.length ? <LedgerList rows={recent} accountNames={names} /> : <EmptyState icon={Wallet} title="No activity yet" description="Your transactions will appear here." />}
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><div><CardTitle>Spending this month</CardTitle><CardDescription>By category, excluding transfers</CardDescription></div></CardHeader>
            <CardContent>
              {flow.byCategory.length ? (
                <CategoryBars data={flow.byCategory} totalCents={flow.byCategory.reduce((a, d) => a + d.cents, 0)} />
              ) : <p className="text-sm text-muted-foreground">No spending yet this month.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div><CardTitle>Pending transfers</CardTitle><CardDescription>Reserved from your balance until they settle</CardDescription></div>
            </CardHeader>
            <CardContent>
              {pending.length ? (
                <ul className="grid gap-3">
                  {pending.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.beneficiary?.nickname ?? t.to?.name ?? "Transfer"}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(t.created_at)}</span>
                      </span>
                      <Money cents={t.amount_cents} direction="debit" className="font-medium" />
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">Nothing pending.</p>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div><CardTitle>Upcoming payments</CardTitle></div>
              <Button asChild variant="ghost" size="sm"><Link href="/scheduled-payments">Manage</Link></Button>
            </CardHeader>
            <CardContent>
              {upcoming.length ? (
                <ul className="grid gap-3">
                  {upcoming.slice(0, 4).map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{p.reference || p.beneficiary?.nickname}</span>
                        <span className="text-xs text-muted-foreground">{formatDate(p.execute_on)}{p.frequency === "monthly" ? " · Monthly" : ""}</span>
                      </span>
                      <Money cents={p.amount_cents} className="font-medium" />
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No scheduled payments.</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
