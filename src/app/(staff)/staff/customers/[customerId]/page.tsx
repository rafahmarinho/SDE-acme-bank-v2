/**
 * Customer detail for staff. Profile comes from staff_customer_detail() (masked phone, no address);
 * accounts, cards, ledger and transfers are read through RLS staff policies (read-only for support).
 * Admin-only controls are rendered for admins and re-checked in every action (T17, T2598).
 */
import { ArrowLeft, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { categoryLabel, Money, PageHeader, StatusBadge } from "@/components/app/common";
import { ROLE_LABEL } from "@/components/app/nav-config";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HttpError } from "@/lib/errors";
import { formatDate, formatDateTime, titleCase } from "@/lib/format";
import { isUuid } from "@/lib/ids";
import { formatMoney } from "@/lib/money";
import { requirePageRole } from "@/lib/page-auth";
import { customerDetail } from "@/services/staff.service";
import { AdminCardForm, RestrictionForm, RoleForm } from "../../staff-forms";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerPage({ params }: { params: Promise<{ customerId: string }> }) {
  const { customerId } = await params;
  if (!isUuid(customerId)) notFound();
  const { user, role, supabase } = await requirePageRole(["support", "admin"]);
  const d = await customerDetail(supabase, customerId).catch((e) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  const isAdmin = role === "admin";

  return (
    <>
      <Link href="/staff" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="size-4" />Staff dashboard</Link>
      <PageHeader title={d.profile.full_name} description={`${d.profile.email} · ${d.profile.phone_masked ?? "no phone"} · ${d.profile.city ?? ""} · customer since ${formatDate(d.profile.created_at)}`}
        actions={<div className="flex gap-2">{d.profile.is_demo ? <Badge variant="brand">Demo customer</Badge> : null}<Badge variant="secondary">{ROLE_LABEL[d.profile.role]}</Badge></div>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Accounts</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {d.accounts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                  <span><span className="font-medium">{a.name}</span> <span className="text-muted-foreground">{a.account_number} · {titleCase(a.kind)}</span></span>
                  <span className="flex items-center gap-2"><StatusBadge status={a.status} /><span className="tabular font-semibold">{formatMoney(a.balance_cents)}</span></span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Cards</CardTitle>{!isAdmin ? <span className="text-xs text-muted-foreground">Read-only for support</span> : null}</CardHeader>
          <CardContent className="grid gap-4">
            {d.cards.map((c) => (
              <div key={c.id} className="grid gap-2 rounded-lg border p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-mono">•••• {c.last4}</span>
                  <span className="flex items-center gap-2"><StatusBadge status={c.status} /><span className="text-muted-foreground">Limit {formatMoney(Number(c.daily_limit_cents))}/day</span></span>
                </div>
                {isAdmin ? <AdminCardForm cardId={c.id} customerId={customerId} status={c.status} limitCents={Number(c.daily_limit_cents)} /> : null}
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Recent transactions</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y">
              {d.ledger.map((l) => (
                <li key={l.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0"><span className="block truncate">{l.description}</span><span className="text-xs text-muted-foreground">{formatDateTime(l.booked_at)} · {categoryLabel(l.category)}</span></span>
                  <Money cents={Number(l.amount_cents)} direction={l.direction} className="font-medium" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <div className="grid content-start gap-6">
          <Card>
            <CardHeader><CardTitle>Recent transfers</CardTitle></CardHeader>
            <CardContent>
              <ul className="divide-y">
                {d.transfers.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0"><span className="block truncate">{t.reference ?? "Transfer"}</span><span className="text-xs text-muted-foreground">{formatDateTime(t.created_at)}</span></span>
                    <span className="flex items-center gap-2"><StatusBadge status={t.status} /><Money cents={Number(t.amount_cents)} /></span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><ShieldAlert aria-hidden className="size-4 text-brand" /><CardTitle>Processing restrictions</CardTitle></div>
            </CardHeader>
            <CardContent className="grid gap-3">
              <p className="text-sm text-muted-foreground">Record an objection the customer made (for example through a privacy request). It is audited.</p>
              {d.profile.restrictions.length ? (
                <ul className="flex flex-wrap gap-2">{d.profile.restrictions.map((r) => <li key={r}><Badge variant="secondary">{titleCase(r)}</Badge></li>)}</ul>
              ) : null}
              <RestrictionForm userId={customerId} existing={d.profile.restrictions} />
            </CardContent>
          </Card>

          {isAdmin && customerId !== user.id ? (
            <Card>
              <CardHeader><CardTitle>Role</CardTitle></CardHeader>
              <CardContent className="grid gap-2">
                <p className="text-sm text-muted-foreground">Changing the role signs the user out everywhere so the new permissions apply.</p>
                <RoleForm userId={customerId} role={d.profile.role} />
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
