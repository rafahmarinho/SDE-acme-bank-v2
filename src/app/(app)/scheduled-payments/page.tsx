/** Scheduled payments: create (fee reviewed first), upcoming list with cancel, and history. */
import { CalendarClock, Repeat } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Money, PageHeader, StatusBadge } from "@/components/app/common";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { requirePageRole } from "@/lib/page-auth";
import { cn } from "@/lib/utils";
import { appToday, listAccounts } from "@/services/accounts.service";
import { listBeneficiaries } from "@/services/beneficiaries.service";
import { listScheduled } from "@/services/scheduled.service";
import { CancelScheduled, ScheduleForm } from "./schedule-forms";

export const metadata: Metadata = { title: "Scheduled payments" };

export default async function ScheduledPage({ searchParams }: { searchParams: Promise<{ view?: string; beneficiary?: string }> }) {
  const { user, supabase } = await requirePageRole(["customer"]);
  const sp = await searchParams;
  const view = sp.view === "history" ? "history" : "upcoming";
  const [accounts, beneficiaries, items, today] = await Promise.all([
    listAccounts(supabase, user.id), listBeneficiaries(supabase, user.id), listScheduled(supabase, user.id, view), appToday(supabase),
  ]);
  const min = new Date(`${today}T00:00:00Z`);
  min.setUTCDate(min.getUTCDate() + 1);

  return (
    <>
      <PageHeader title="Scheduled payments" description="Pay bills and people on a date you choose." actions={<RealtimeRefresher channel="scheduled" tables={["scheduled_payments"]} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div>
          <div className="mb-4 inline-flex rounded-lg bg-muted p-1" role="tablist">
            {(["upcoming", "history"] as const).map((v) => (
              <Link key={v} href={`/scheduled-payments${v === "history" ? "?view=history" : ""}`} role="tab" aria-selected={view === v}
                className={cn("rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground", view === v && "bg-card text-foreground shadow-sm")}>
                {v === "upcoming" ? "Upcoming" : "History"}
              </Link>
            ))}
          </div>
          {items.length === 0 ? (
            <EmptyState icon={CalendarClock} title={view === "upcoming" ? "Nothing scheduled" : "No past scheduled payments"} />
          ) : (
            <ul className="grid gap-3">
              {items.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-xl border bg-card p-4 shadow-xs">
                  <div className="grid w-14 shrink-0 place-items-center rounded-lg bg-secondary py-2 text-primary">
                    <span className="text-[11px] font-medium uppercase">{formatDate(p.execute_on).split(" ")[0]}</span>
                    <span className="text-lg leading-none font-semibold">{p.execute_on.slice(8, 10)}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{p.reference || `Payment to ${p.beneficiary?.nickname}`}</p>
                    <p className="text-xs text-muted-foreground">To {p.beneficiary?.nickname} · from {p.account?.name} · {formatDate(p.execute_on)}</p>
                    <div className="mt-1 flex gap-2">
                      {p.frequency === "monthly" ? <Badge variant="secondary"><Repeat aria-hidden />Monthly</Badge> : null}
                      {view === "history" ? <StatusBadge status={p.status} /> : null}
                    </div>
                  </div>
                  <Money cents={p.amount_cents} className="font-semibold" />
                  {p.status === "scheduled" ? <CancelScheduled id={p.id} label={`${p.reference || p.beneficiary?.nickname} on ${formatDate(p.execute_on)}`} /> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader><div><CardTitle>New scheduled payment</CardTitle><CardDescription>The fee is shown before you confirm.</CardDescription></div></CardHeader>
          <CardContent>
            <ScheduleForm
              accounts={accounts.filter((a) => a.status === "active")}
              beneficiaries={beneficiaries}
              minDate={min.toISOString().slice(0, 10)}
              defaultBeneficiary={beneficiaries.some((b) => b.id === sp.beneficiary) ? sp.beneficiary : undefined}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
