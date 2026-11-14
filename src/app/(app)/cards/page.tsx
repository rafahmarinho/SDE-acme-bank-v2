/**
 * Cards: block/unblock, daily limit, today's usage and recent authorizations (approved / declined).
 * Simulated cards only - the app stores the last 4 digits, never a PAN or CVV.
 */
import { CreditCard, Wifi } from "lucide-react";
import type { Metadata } from "next";
import { categoryLabel, EmptyState, Money, PageHeader, StatusBadge } from "@/components/app/common";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { requirePageRole } from "@/lib/page-auth";
import { cn } from "@/lib/utils";
import { appToday } from "@/services/accounts.service";
import { listCards, recentAuthorizations } from "@/services/cards.service";
import { CardLimitControl, CardStatusControl } from "./card-controls";

export const metadata: Metadata = { title: "Cards" };

const DECLINE: Record<string, string> = { card_blocked: "Card blocked", daily_limit: "Over daily limit", insufficient_funds: "Insufficient funds" };

export default async function CardsPage() {
  const { user, supabase } = await requirePageRole(["customer"]);
  const today = await appToday(supabase);
  const [cards, profile] = await Promise.all([
    listCards(supabase, user.id, today),
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
  ]);
  const auths = await recentAuthorizations(supabase, cards.map((c) => c.id), 15);
  const holder = profile.data?.full_name?.toUpperCase() ?? "";

  return (
    <>
      <PageHeader title="Cards" description="Control your debit card instantly." actions={<RealtimeRefresher channel="cards" tables={["cards", "card_authorizations"]} />} />
      {cards.length === 0 ? <EmptyState icon={CreditCard} title="No cards yet" /> : null}
      <div className="grid gap-6">
        {cards.map((c) => {
          const used = Math.min(100, c.daily_limit_cents > 0 ? Math.round((c.spent_today_cents / c.daily_limit_cents) * 100) : 100);
          return (
            <div key={c.id} className="grid gap-6 lg:grid-cols-[22rem_1fr]">
              <div>
                <div className={cn(
                  "relative aspect-[1.586] w-full max-w-sm overflow-hidden rounded-2xl p-6 text-white shadow-lg transition",
                  c.status === "blocked" ? "bg-gradient-to-br from-slate-500 to-slate-700 grayscale" : "bg-gradient-to-br from-navy-800 via-navy-900 to-navy-950",
                )}>
                  <div aria-hidden className="absolute -top-16 -right-10 size-48 rounded-full bg-brand/30 blur-2xl" />
                  <div className="relative flex h-full flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <span className="font-semibold">ACME <span className="text-brand">Bank</span></span>
                      <Wifi aria-hidden className="size-5 rotate-90 text-white/70" />
                    </div>
                    <div>
                      <div aria-hidden className="mb-4 h-8 w-11 rounded-md bg-gradient-to-br from-amber-200 to-amber-500" />
                      <p className="font-mono text-lg tracking-[0.2em]" aria-label={`Card ending in ${c.last4}`}>•••• •••• •••• {c.last4}</p>
                      <div className="mt-2 flex items-end justify-between text-xs text-white/80">
                        <span className="truncate">{holder}</span>
                        <span>DEBIT</span>
                      </div>
                    </div>
                  </div>
                  {c.status === "blocked" ? <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-destructive px-3 py-1 text-xs font-semibold">BLOCKED</span> : null}
                </div>
                <p className="mt-3 text-sm text-muted-foreground">Linked to {c.account?.name ?? "your account"}</p>
              </div>

              <div className="grid content-start gap-6 md:grid-cols-2">
                <Card>
                  <CardHeader><CardTitle>Card status</CardTitle><StatusBadge status={c.status} /></CardHeader>
                  <CardContent className="grid gap-4">
                    <p className="text-sm text-muted-foreground">{c.status === "active" ? "Lost your card or see something odd? Block it now - it takes effect immediately." : "All purchases are being declined. Unblock when you're ready."}</p>
                    <CardStatusControl cardId={c.id} status={c.status} />
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><div><CardTitle>Daily limit</CardTitle><CardDescription>Resets every day at midnight UTC.</CardDescription></div></CardHeader>
                  <CardContent className="grid gap-4">
                    <div>
                      <div className="flex justify-between text-sm"><span>Spent today</span><span className="tabular font-medium">{formatMoney(c.spent_today_cents)} of {formatMoney(c.daily_limit_cents)}</span></div>
                      <div className="mt-2 h-2 rounded-full bg-muted" role="progressbar" aria-valuenow={used} aria-valuemin={0} aria-valuemax={100} aria-label="Daily limit used">
                        <div className={cn("h-2 rounded-full", used >= 90 ? "bg-destructive" : "bg-brand")} style={{ width: `${used}%` }} />
                      </div>
                    </div>
                    <CardLimitControl cardId={c.id} limitCents={c.daily_limit_cents} />
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })}

        {cards.length ? (
          <Card>
            <CardHeader><div><CardTitle>Recent card activity</CardTitle><CardDescription>Approved and declined authorizations</CardDescription></div></CardHeader>
            <CardContent>
              {auths.length ? (
                <ul className="divide-y">
                  {auths.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{a.merchant}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(a.at)} · {categoryLabel(a.category)}{a.decline_reason ? ` · ${DECLINE[a.decline_reason] ?? "Declined"}` : ""}</p>
                      </div>
                      <StatusBadge status={a.status} />
                      <Money cents={a.amount_cents} className={cn("w-24 text-right text-sm font-medium", a.status === "declined" && "text-muted-foreground line-through")} />
                    </li>
                  ))}
                </ul>
              ) : <p className="text-sm text-muted-foreground">No card activity yet.</p>}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
