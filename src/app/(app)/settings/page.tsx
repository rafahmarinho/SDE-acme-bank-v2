/**
 * Settings: security (password, sessions) for every role; privacy & consent management and
 * processing restrictions for customers. Each optional consent shows its current state and a toggle;
 * withdrawing takes effect immediately (email/analytics services check consents before acting - T604, T754).
 */
import { KeyRound, LockKeyhole, ShieldCheck, UserRoundCog } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ROLE_LABEL } from "@/components/app/nav-config";
import { PageHeader } from "@/components/app/common";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/feedback";
import { formatDate, formatDateTime } from "@/lib/format";
import { requirePageRole } from "@/lib/page-auth";
import { listConsents, OPTIONAL_PURPOSES } from "@/services/privacy.service";
import { ChangePasswordForm, ConsentToggle, SignOutOthersForm } from "./settings-forms";

export const metadata: Metadata = { title: "Settings" };

const CONSENT_TEXT: Record<string, { label: string; description: string }> = {
  marketing_email: { label: "Product news by email", description: "Occasional emails about new ACME Bank features and offers." },
  product_analytics: { label: "Usage analytics", description: "Anonymous app usage data to improve ACME Bank. Never your transactions." },
};

const RESTRICTION_TEXT: Record<string, string> = {
  marketing_email: "Marketing emails", product_analytics: "Usage analytics", staff_bulk_export: "Bulk data exports", all_non_essential: "All non-essential processing",
};

export default async function SettingsPage() {
  const { user, role, supabase } = await requirePageRole(["customer", "support", "admin"]);
  const isCustomer = role === "customer";
  const [consents, restrictions] = isCustomer
    ? await Promise.all([
        listConsents(supabase, user.id),
        supabase.from("processing_restrictions").select("activity, created_at").eq("user_id", user.id).limit(10).then((r) => r.data ?? []),
      ])
    : [[], []];
  const state = new Map(consents.map((c) => [c.purpose, c]));

  return (
    <>
      <PageHeader title="Settings" description="Security, privacy and how we use your data." />
      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><UserRoundCog aria-hidden className="size-5" /></span>
              <div><CardTitle>Account</CardTitle><CardDescription>{user.email}</CardDescription></div>
            </div>
            <Badge variant="secondary">{ROLE_LABEL[role]}</Badge>
          </CardHeader>
          <CardContent className="grid gap-1 text-sm text-muted-foreground">
            <p>Member since {formatDate(user.created_at)}</p>
            {user.last_sign_in_at ? <p>Last sign-in {formatDateTime(user.last_sign_in_at)}</p> : null}
            {isCustomer ? <p>Need to update your name, phone or address? <Link href="/profile" className="font-medium text-brand hover:underline">Edit your profile</Link></p> : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><KeyRound aria-hidden className="size-5" /></span>
              <div><CardTitle>Password</CardTitle><CardDescription>Changing your password signs you out everywhere else.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent><ChangePasswordForm /></CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-lg bg-secondary text-primary"><LockKeyhole aria-hidden className="size-5" /></span>
              <div><CardTitle>Sessions</CardTitle><CardDescription>Lost a device or used a shared computer? End every other session.</CardDescription></div>
            </div>
          </CardHeader>
          <CardContent><SignOutOthersForm /></CardContent>
        </Card>

        {isCustomer ? (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground"><ShieldCheck aria-hidden className="size-5" /></span>
                <div><CardTitle>Privacy and consent</CardTitle><CardDescription>Optional choices. Turning one off stops that use of your data right away.</CardDescription></div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y">
                {OPTIONAL_PURPOSES.map((purpose) => (
                  <ConsentToggle key={purpose} purpose={purpose} granted={state.get(purpose)?.granted === true} {...CONSENT_TEXT[purpose]!} />
                ))}
              </div>
              <Separator className="my-4" />
              <div className="grid gap-2 text-sm">
                <p className="font-medium">Required to run your account</p>
                <p className="text-muted-foreground">
                  Terms of Service and Privacy Notice accepted{state.get("terms") ? ` on ${formatDate(state.get("terms")!.updated_at)} (version ${state.get("terms")!.notice_version})` : ""}.
                  To withdraw them, close your account through Support.
                </p>
                <p className="mt-2 font-medium">Restrictions on processing</p>
                {restrictions.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {restrictions.map((r) => <li key={r.activity}><Badge variant="secondary">{RESTRICTION_TEXT[r.activity] ?? r.activity}</Badge></li>)}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">None. To object to a specific use of your data, <Link href="/support?new=privacy" className="font-medium text-brand hover:underline">contact Support</Link>.</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </>
  );
}
