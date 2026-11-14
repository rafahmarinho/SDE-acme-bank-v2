/**
 * Support thread. Ticket id is validated as a UUID and loaded with an ownership filter for
 * customers (404 when not theirs - T378). Messages are plain text (whitespace preserved), never HTML (T36).
 */
import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader, StatusBadge } from "@/components/app/common";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Alert, AlertDescription } from "@/components/ui/feedback";
import { HttpError } from "@/lib/errors";
import { formatDateTime, titleCase } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { requirePageRole } from "@/lib/page-auth";
import { cn } from "@/lib/utils";
import { getTicket } from "@/services/support.service";
import { ReplyForm, TicketStatusButton } from "../support-forms";

export const metadata: Metadata = { title: "Support request" };

export default async function TicketPage({ params, searchParams }: { params: Promise<{ ticketId: string }>; searchParams: Promise<{ created?: string }> }) {
  const { ticketId } = await params;
  const { created } = await searchParams;
  if (!isUuid(ticketId)) notFound();
  const { user, role, supabase } = await requirePageRole(["customer", "support", "admin"]);
  const data = await getTicket(supabase, user.id, role, ticketId).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const { ticket, replies, customerName } = data;
  const staff = role !== "customer";
  const messages = [
    { id: "first", author_role: "customer", author_id: ticket.customer_id, body: ticket.body, created_at: ticket.created_at },
    ...replies,
  ];

  return (
    <>
      <Link href="/support" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="size-4" />All requests</Link>
      <PageHeader
        title={ticket.subject}
        description={`${staff && customerName ? `${customerName} · ` : ""}${titleCase(ticket.category)} · opened ${formatDateTime(ticket.created_at)}`}
        actions={
          <div className="flex items-center gap-3">
            <RealtimeRefresher channel={`ticket-${ticket.id}`} tables={["support_replies", "support_tickets"]} />
            <StatusBadge status={ticket.status} />
            {ticket.status !== "closed" ? <TicketStatusButton ticketId={ticket.id} next="closed" label="Close request" /> : staff ? <TicketStatusButton ticketId={ticket.id} next="open" label="Reopen" /> : null}
          </div>
        }
      />
      {created ? <Alert variant="success" className="mb-4"><AlertDescription>Thanks - we received your request and will reply here.</AlertDescription></Alert> : null}
      <ol className="grid gap-4">
        {messages.map((m) => {
          const mine = m.author_id === user.id;
          const fromStaff = m.author_role !== "customer";
          return (
            <li key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-4 py-3 shadow-xs sm:max-w-[70%]", mine ? "rounded-br-sm bg-primary text-primary-foreground" : fromStaff ? "rounded-bl-sm border border-brand/30 bg-accent" : "rounded-bl-sm border bg-card")}>
                <p className={cn("mb-1 text-xs font-medium", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                  {mine ? "You" : fromStaff ? "ACME Support" : customerName ?? "Customer"} · {formatDateTime(m.created_at)}
                </p>
                <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mt-6 rounded-xl border bg-card p-4 shadow-xs">
        {ticket.status === "closed" ? (
          <p className="text-sm text-muted-foreground">This request is closed. {staff ? "Reopen it to reply." : <Link href="/support" className="font-medium text-brand hover:underline">Open a new request</Link>}</p>
        ) : <ReplyForm ticketId={ticket.id} />}
      </div>
    </>
  );
}
