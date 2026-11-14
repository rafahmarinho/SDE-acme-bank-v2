/**
 * Audit log (admin only - proxy rule, page check and SQL check in admin_audit_log()).
 * Shows who did what, when, on which row and which columns changed - not the values (T349, T2602).
 * The audit table itself is append-only and lives in a schema the API doesn't expose.
 */
import { ScrollText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader } from "@/components/app/common";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime, titleCase } from "@/lib/format";
import { requirePageRole } from "@/lib/page-auth";
import { cn } from "@/lib/utils";
import { AuditFilter, auditLog } from "@/services/staff.service";

export const metadata: Metadata = { title: "Audit log" };

const TABLES = ["event", "cards", "transfers", "ledger_entries", "profiles", "beneficiaries", "scheduled_payments", "consents", "processing_restrictions", "statements"] as const;

export default async function AuditPage({ searchParams }: { searchParams: Promise<{ table?: string }> }) {
  const { supabase } = await requirePageRole(["admin"]);
  const parsed = AuditFilter.safeParse({ table: (await searchParams).table || undefined });
  const table = parsed.success ? parsed.data.table : undefined;
  const rows = await auditLog(supabase, table, 100);
  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of changes to money, card, authorization and personal data. Latest 100 entries." />
      <div className="mb-4 flex flex-wrap gap-2">
        {[undefined, ...TABLES].map((t) => (
          <Link key={t ?? "all"} href={`/staff/audit${t ? `?table=${t}` : ""}`}
            className={cn("rounded-full border px-3 py-1 text-sm", table === t ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
            {t ? (t === "event" ? "Security events" : titleCase(t)) : "All"}
          </Link>
        ))}
      </div>
      {rows.length === 0 ? <EmptyState icon={ScrollText} title="No audit entries" /> : (
        <Card className="py-2">
          <Table>
            <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Object</TableHead><TableHead>Action</TableHead><TableHead className="hidden lg:table-cell">Changed</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(r.at)}</TableCell>
                  <TableCell>
                    <Badge variant={r.actor_role === "admin" ? "default" : r.actor_role === "support" ? "brand" : "secondary"}>{r.actor_role ?? "system"}</Badge>
                    <span className="ml-2 font-mono text-xs text-muted-foreground">{r.actor ? r.actor.slice(0, 8) : "-"}</span>
                  </TableCell>
                  <TableCell><span className="font-medium">{r.table_name === "event" ? "Security event" : titleCase(r.table_name)}</span> <span className="font-mono text-xs text-muted-foreground">{r.row_id?.slice(0, 8)}</span></TableCell>
                  <TableCell className="font-mono text-xs">{r.op}</TableCell>
                  <TableCell className="hidden max-w-72 truncate text-xs text-muted-foreground lg:table-cell">{r.changed?.filter((c) => c !== "updated_at").join(", ") || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </>
  );
}
