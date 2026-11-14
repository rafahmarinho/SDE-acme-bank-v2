/**
 * Statements: generate CSV / PDF and download previously generated ones. Downloads go through
 * /api/statements/{uuid} (owner check + 60 s signed URL); file paths never reach the browser (T50).
 */
import { Download, FileText } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState, PageHeader } from "@/components/app/common";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { requirePageRole } from "@/lib/page-auth";
import { appToday, listAccounts } from "@/services/accounts.service";
import { listStatements } from "@/services/statements.service";
import { StatementForm } from "./statement-form";

export const metadata: Metadata = { title: "Statements" };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

export default async function StatementsPage({ searchParams }: { searchParams: Promise<{ account?: string }> }) {
  const { user, supabase } = await requirePageRole(["customer"]);
  const { account } = await searchParams;
  const [accounts, statements, today] = await Promise.all([listAccounts(supabase, user.id), listStatements(supabase, user.id), appToday(supabase)]);
  const t = new Date(`${today}T00:00:00Z`);
  const thisMonth = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 1));
  const lastMonthStart = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 1));
  const lastMonthEnd = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), 0));
  const twoAgoStart = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 2, 1));
  const twoAgoEnd = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 1, 0));
  const presets = [
    { key: "last", label: MONTH.format(lastMonthStart), start: iso(lastMonthStart), end: iso(lastMonthEnd) },
    { key: "two", label: MONTH.format(twoAgoStart), start: iso(twoAgoStart), end: iso(twoAgoEnd) },
    { key: "this", label: "This month so far", start: iso(thisMonth), end: today },
    { key: "90", label: "Last 90 days", start: iso(new Date(t.getTime() - 89 * 86_400_000)), end: today },
  ];

  return (
    <>
      <PageHeader title="Statements" description="Download your account statements as PDF or CSV." />
      <div className="grid gap-6 lg:grid-cols-[24rem_1fr]">
        <Card className="h-fit">
          <CardHeader><div><CardTitle>Create a statement</CardTitle><CardDescription>Up to 12 months per statement.</CardDescription></div></CardHeader>
          <CardContent>
            <StatementForm accounts={accounts} presets={presets} defaultAccount={accounts.some((a) => a.id === account) ? account : undefined} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><div><CardTitle>Your statements</CardTitle><CardDescription>Files are private to you. Download links expire after 60 seconds.</CardDescription></div></CardHeader>
          <CardContent>
            {statements.length === 0 ? (
              <EmptyState icon={FileText} title="No statements yet" description="Create your first statement on the left." />
            ) : (
              <ul className="divide-y">
                {statements.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-3 py-3">
                    <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><FileText aria-hidden className="size-5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{s.account?.name} · {formatDate(s.period_start)} - {formatDate(s.period_end)}</p>
                      <p className="text-xs text-muted-foreground">Created {formatDateTime(s.created_at)}</p>
                    </div>
                    <Badge variant="secondary">{s.format.toUpperCase()}</Badge>
                    <Button asChild variant="outline" size="sm"><a href={`/api/statements/${s.id}`}><Download aria-hidden />Download</a></Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
