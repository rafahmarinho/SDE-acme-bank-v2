/** Beneficiaries: search, add (step-up protected) and remove saved payees. */
import { Building2, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form-controls";
import { formatDate } from "@/lib/format";
import { requirePageRole } from "@/lib/page-auth";
import { listBeneficiaries } from "@/services/beneficiaries.service";
import { AddBeneficiary, DeleteBeneficiary } from "./beneficiary-forms";

export const metadata: Metadata = { title: "Beneficiaries" };

export default async function BeneficiariesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, supabase } = await requirePageRole(["customer"]);
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.slice(0, 60) : "";
  const list = await listBeneficiaries(supabase, user.id, search);
  return (
    <>
      <PageHeader title="Beneficiaries" description="People and companies you pay." actions={<AddBeneficiary />} />
      <form method="get" role="search" className="mb-4 flex max-w-md gap-2">
        <Input name="q" type="search" defaultValue={search} placeholder="Search by name" aria-label="Search beneficiaries" maxLength={60} />
        <Button type="submit" variant="outline">Search</Button>
      </form>
      {list.length === 0 ? (
        <EmptyState icon={Users} title={search ? "No beneficiaries match your search" : "No beneficiaries yet"} description={search ? undefined : "Add someone to send them money in a few taps."} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((b) => (
            <li key={b.id} className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-xs">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-secondary font-semibold text-primary">{b.nickname.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{b.nickname}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 aria-hidden className="size-3" />{b.bank_name} · •••• {b.account_number.slice(-4)}</p>
                <p className="mt-1 text-xs text-muted-foreground">Added {formatDate(b.created_at)}</p>
                <div className="mt-3 flex gap-2">
                  <Button asChild size="sm"><Link href={`/transfers`}>Send money</Link></Button>
                  <Button asChild size="sm" variant="outline"><Link href={`/scheduled-payments?beneficiary=${b.id}`}>Schedule</Link></Button>
                </div>
              </div>
              <DeleteBeneficiary id={b.id} name={b.nickname} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
