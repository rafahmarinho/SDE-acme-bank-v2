/**
 * Staff dashboard (support + admin): aggregated, non-identifying figures (T544), a masked customer
 * search that needs >= 3 characters and returns at most 20 results (T2600, T2139), and daily activity.
 */
import { AlertTriangle, ArrowLeftRight, Banknote, ChevronRight, CreditCard, Inbox, Search, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, StatTile } from "@/components/app/common";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/form-controls";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatLongDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { requirePageRole } from "@/lib/page-auth";
import { activityDaily, dashboardStats, searchCustomers } from "@/services/staff.service";

export const metadata: Metadata = { title: "Staff dashboard" };

export default async function StaffPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { role, supabase } = await requirePageRole(["support", "admin"]);
  const { q } = await searchParams;
  const query = typeof q === "string" ? q.trim().slice(0, 100) : "";
  const [stats, activity, results] = await Promise.all([
    dashboardStats(supabase), activityDaily(supabase, 10), query.length >= 3 ? searchCustomers(supabase, query) : Promise.resolve(null),
  ]);
  const days = new Map<string, { in: number; out: number; n: number }>();
  for (const a of activity) {
    const d = days.get(a.day) ?? { in: 0, out: 0, n: 0 };
    if (a.direction === "credit") d.in += a.total_cents; else d.out += a.total_cents;
    d.n += a.entries;
    days.set(a.day, d);
  }

  return (
    <>
      <PageHeader
        title="Staff dashboard"
        description={`${role === "admin" ? "Administrator" : "Support"} view · simulated date ${formatLongDate(stats.sim_date)}`}
        actions={<RealtimeRefresher channel="staff" tables={["transfers", "support_tickets", "cards"]} />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile tone="navy" label="Customer deposits" value={formatMoney(stats.deposits_cents)} hint={`${stats.accounts} open accounts`} icon={Banknote} />
        <StatTile label="Customers" value={stats.customers} icon={Users} />
        <StatTile label="Pending transfers" value={stats.pending_transfers} icon={ArrowLeftRight} />
        <StatTile tone={stats.open_tickets > 0 ? "brand" : "default"} label="Open tickets" value={stats.open_tickets} hint={<Link href="/support?status=open" className="font-medium text-accent-foreground hover:underline">Go to queue</Link>} icon={Inbox} />
        <StatTile label="Blocked cards" value={stats.blocked_cards} icon={CreditCard} />
        <StatTile label="Declined today" value={stats.declined_today} hint="Card authorizations" icon={AlertTriangle} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader><div><CardTitle>Find a customer</CardTitle><CardDescription>Search by name (starts with) or exact email. At least 3 characters.</CardDescription></div></CardHeader>
          <CardContent className="grid gap-4">
            <form method="get" role="search" className="flex gap-2">
              <Input name="q" type="search" defaultValue={query} minLength={3} maxLength={100} placeholder="e.g. Avery or customer1@demo.acme-bank.example" aria-label="Search customers" />
              <Button type="submit"><Search aria-hidden />Search</Button>
            </form>
            {results === null ? (
              <p className="text-sm text-muted-foreground">{query ? "Type at least 3 characters." : "Results show a masked phone number. Open a customer to see accounts and cards."}</p>
            ) : results.length === 0 ? (
              <EmptyState icon={Search} title="No customers found" description="Check the spelling or search by the full email address." />
            ) : (
              <ul className="divide-y rounded-lg border">
                {results.map((c) => (
                  <li key={c.id}>
                    <Link href={`/staff/customers/${c.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/50">
                      <span className="grid size-9 place-items-center rounded-full bg-secondary text-sm font-semibold text-primary">{c.full_name.slice(0, 1)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{c.full_name}</p>
                        <p className="truncate text-xs text-muted-foreground">{c.email} · {c.phone_masked ?? "no phone"} · {c.account_count} account{c.account_count === 1 ? "" : "s"}</p>
                      </div>
                      <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><div><CardTitle>Daily activity</CardTitle><CardDescription>All customers, aggregated (no personal data)</CardDescription></div></CardHeader>
          <CardContent>
            <Table>
              <TableHeader><TableRow><TableHead>Day</TableHead><TableHead className="text-right">Entries</TableHead><TableHead className="text-right">In</TableHead><TableHead className="text-right">Out</TableHead></TableRow></TableHeader>
              <TableBody>
                {[...days.entries()].map(([day, d]) => (
                  <TableRow key={day}>
                    <TableCell className="whitespace-nowrap">{formatDate(day)}</TableCell>
                    <TableCell className="tabular text-right">{d.n}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(d.in)}</TableCell>
                    <TableCell className="tabular text-right">{formatMoney(d.out)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
