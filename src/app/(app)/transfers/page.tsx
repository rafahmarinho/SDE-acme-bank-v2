/** Transfers: new transfer (fee before confirmation) and history with status filter. */
import { ArrowLeftRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, Money, PageHeader, StatusBadge } from "@/components/app/common";
import { RealtimeRefresher } from "@/components/app/realtime-refresher";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { requirePageRole } from "@/lib/page-auth";
import { cn } from "@/lib/utils";
import { listAccounts } from "@/services/accounts.service";
import { listBeneficiaries } from "@/services/beneficiaries.service";
import { listTransfers, TRANSFER_STATUSES } from "@/services/transfers.service";
import { TransferForm } from "./transfer-form";

export const metadata: Metadata = { title: "Transfers" };

type SP = { tab?: string; status?: string; from?: string };

export default async function TransfersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, supabase } = await requirePageRole(["customer"]);
  const sp = await searchParams;
  const tab = sp.tab === "history" ? "history" : "new";
  const status = (TRANSFER_STATUSES as readonly string[]).includes(sp.status ?? "") ? sp.status : undefined;

  const tabs = (
    <div className="mb-6 inline-flex rounded-lg bg-muted p-1" role="tablist">
      {(["new", "history"] as const).map((t) => (
        <Link key={t} href={`/transfers${t === "history" ? "?tab=history" : ""}`} role="tab" aria-selected={tab === t}
          className={cn("rounded-md px-4 py-1.5 text-sm font-medium text-muted-foreground", tab === t && "bg-card text-foreground shadow-sm")}>
          {t === "new" ? "New transfer" : "History"}
        </Link>
      ))}
    </div>
  );

  if (tab === "new") {
    const [accounts, beneficiaries] = await Promise.all([listAccounts(supabase, user.id), listBeneficiaries(supabase, user.id)]);
    const active = accounts.filter((a) => a.status === "active");
    return (
      <>
        <PageHeader title="Transfers" description="Send money between your accounts or to a beneficiary." />
        {tabs}
        <Card className="max-w-2xl">
          <CardContent>
            <TransferForm
              accounts={active}
              beneficiaries={beneficiaries}
              defaultFrom={active.some((a) => a.id === sp.from) ? sp.from : undefined}
            />
          </CardContent>
        </Card>
      </>
    );
  }

  const transfers = await listTransfers(supabase, user.id, 50, status);
  return (
    <>
      <PageHeader title="Transfers" description="Send money between your accounts or to a beneficiary." actions={<RealtimeRefresher channel="transfers" tables={["transfers"]} />} />
      {tabs}
      <div className="mb-4 flex flex-wrap gap-2" aria-label="Filter by status">
        {[undefined, ...TRANSFER_STATUSES].map((s) => (
          <Link key={s ?? "all"} href={`/transfers?tab=history${s ? `&status=${s}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-sm", status === s ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
            {s ? s[0]!.toUpperCase() + s.slice(1) : "All"}
          </Link>
        ))}
      </div>
      {transfers.length === 0 ? (
        <EmptyState icon={ArrowLeftRight} title="No transfers here" description={status ? "Try another status." : "Your transfers will show up here."} />
      ) : (
        <Card className="py-2">
          <Table>
            <TableHeader>
              <TableRow><TableHead>Date</TableHead><TableHead>To</TableHead><TableHead className="hidden sm:table-cell">Reference</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="hidden text-right md:table-cell">Fee</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {transfers.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(t.created_at)}</TableCell>
                  <TableCell>
                    <span className="font-medium">{t.beneficiary?.nickname ?? t.to?.name ?? "-"}</span>
                    <span className="block text-xs text-muted-foreground">{t.beneficiary ? t.beneficiary.bank_name : "Own account"} · from {t.from?.name}</span>
                  </TableCell>
                  <TableCell className="hidden max-w-48 truncate sm:table-cell">{t.reference ?? "-"}</TableCell>
                  <TableCell><StatusBadge status={t.status} /></TableCell>
                  <TableCell className="text-right font-medium"><Money cents={t.amount_cents} /></TableCell>
                  <TableCell className="hidden text-right text-muted-foreground md:table-cell">{t.fee_cents ? <Money cents={t.fee_cents} /> : "Free"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
