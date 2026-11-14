/**
 * Support. Customers: their requests + a new-request form. Support/admin: the ticket queue
 * (customer names only) with status filters. Same URL, data scoped by role on the server + RLS.
 */
import { ChevronRight, Inbox, LifeBuoy, MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, StatusBadge } from "@/components/app/common";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime, titleCase } from "@/lib/format";
import { requirePageRole } from "@/lib/page-auth";
import { cn } from "@/lib/utils";
import { listTickets, TICKET_CATEGORIES, TICKET_STATUSES } from "@/services/support.service";
import { NewTicketForm } from "./support-forms";

export const metadata: Metadata = { title: "Support" };

export default async function SupportPage({ searchParams }: { searchParams: Promise<{ status?: string; new?: string }> }) {
  const { user, role, supabase } = await requirePageRole(["customer", "support", "admin"]);
  const sp = await searchParams;
  const status = (TICKET_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;
  const tickets = await listTickets(supabase, user.id, role, status);
  const staff = role !== "customer";

  const filters = (
    <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
      {[undefined, ...TICKET_STATUSES].map((s) => (
        <Link key={s ?? "all"} href={`/support${s ? `?status=${s}` : ""}`}
          className={cn("rounded-full border px-3 py-1 text-sm", status === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
          {s ? titleCase(s) : "All"}
        </Link>
      ))}
    </div>
  );

  const list = tickets.length === 0 ? (
    <EmptyState icon={staff ? Inbox : MessageSquare} title={staff ? "No tickets in this view" : "No requests yet"} description={staff ? undefined : "Questions about your account? We usually reply within a day."} />
  ) : (
    <ul className="divide-y rounded-xl border bg-card shadow-xs">
      {tickets.map((t) => (
        <li key={t.id}>
          <Link href={`/support/${t.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{t.subject}</p>
              <p className="text-xs text-muted-foreground">
                {staff && t.customer_name ? `${t.customer_name} · ` : ""}{titleCase(t.category)} · updated {formatDateTime(t.updated_at)}
                {typeof t.reply_count === "number" ? ` · ${t.reply_count} repl${t.reply_count === 1 ? "y" : "ies"}` : ""}
              </p>
            </div>
            <StatusBadge status={t.status} />
            <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );

  if (staff) {
    return (
      <>
        <PageHeader title="Support tickets" description="Open requests are listed first." actions={<RealtimeRefresher channel="tickets" tables={["support_tickets", "support_replies"]} />} />
        {filters}
        {list}
      </>
    );
  }
  return (
    <>
      <PageHeader title="Support" description="We're here to help." actions={<RealtimeRefresher channel="support" tables={["support_tickets", "support_replies"]} />} />
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div>{filters}{list}</div>
        <Card className="h-fit">
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground"><LifeBuoy aria-hidden className="size-5" /></span>
              <div><CardTitle>New request</CardTitle><CardDescription>Tell us what you need.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent>
            <NewTicketForm defaultCategory={(TICKET_CATEGORIES as readonly string[]).includes(sp.new ?? "") ? sp.new : undefined} />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
