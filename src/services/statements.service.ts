/**
 * Statement generation (CSV / PDF) and private storage.
 *
 * - Generated in memory; nothing is written to local disk or under public/.
 * - Stored in the PRIVATE `statements` bucket at a server-generated path
 *   {customer_uuid}/{statement_uuid}.{format}; clients only ever see the statement UUID.
 * - CSV cells are formula-injection safe (src/lib/csv.ts).
 * - PDF is rendered from React components with data passed as props (no template compilation
 *   of user-controlled strings, so no server-side template injection).
 */
import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createElement as h } from "react";
import { z } from "zod";
import { formatCents, toCsv } from "@/lib/csv";
import { HttpError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { adminClient } from "@/lib/supabase/admin";

export const StatementRequest = z
  .object({
    accountId: z.string().uuid(),
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
    format: z.enum(["csv", "pdf"]),
  })
  .refine((v) => v.periodEnd >= v.periodStart, "Invalid period")
  .refine((v) => (Date.parse(v.periodEnd) - Date.parse(v.periodStart)) / 86_400_000 <= 366, "Period too long");

const MAX_ROWS = 10_000;

type Row = { booked_at: string; description: string; amount_cents: number; direction: "debit" | "credit" };

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 10 },
  title: { fontSize: 16, marginBottom: 12 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
});

function StatementPdf({ period, rows }: { period: string; rows: Row[] }) {
  return h(Document, null,
    h(Page, { size: "A4", style: styles.page },
      h(Text, { style: styles.title }, `ACME Bank statement - ${period}`),
      ...rows.map((r, i) =>
        h(View, { key: String(i), style: styles.row },
          h(Text, null, r.booked_at.slice(0, 10)),
          h(Text, null, r.description), // plain text node, never interpreted
          h(Text, null, `${r.direction === "debit" ? "-" : ""}${formatCents(r.amount_cents)}`),
        ),
      ),
    ),
  );
}

export async function generateStatement(supabase: SupabaseClient, userId: string, input: z.infer<typeof StatementRequest>) {
  // Ownership via the user-scoped client (RLS + explicit filter).
  const { data: account } = await supabase
    .from("accounts").select("id").eq("id", input.accountId).eq("customer_id", userId).maybeSingle();
  if (!account) throw new HttpError(404);

  const { data: rows, error } = await supabase
    .from("ledger_entries")
    .select("booked_at, description, amount_cents, direction")
    .eq("account_id", input.accountId)
    .gte("booked_at", input.periodStart)
    .lte("booked_at", `${input.periodEnd}T23:59:59.999Z`)
    .order("booked_at")
    .limit(MAX_ROWS);
  if (error) throw new HttpError(500);

  const period = `${input.periodStart} to ${input.periodEnd}`;
  const body =
    input.format === "csv"
      ? Buffer.from(toCsv(["Date", "Description", "Direction", "Amount"], (rows as Row[]).map((r) => [
          r.booked_at.slice(0, 10), r.description, r.direction, formatCents(r.amount_cents),
        ])), "utf8")
      : await renderToBuffer(StatementPdf({ period, rows: rows as Row[] }));

  const statementId = newId();
  const storagePath = `${userId}/${statementId}.${input.format}`;
  const admin = adminClient(); // write-only use: the bucket has no client insert policy
  const { error: uploadError } = await admin.storage.from("statements").upload(storagePath, body, {
    contentType: input.format === "csv" ? "text/csv" : "application/pdf",
    upsert: false,
  });
  if (uploadError) throw new HttpError(500);
  const { error: insertError } = await admin.from("statements").insert({
    id: statementId,
    customer_id: userId,
    account_id: input.accountId,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    format: input.format,
    storage_path: storagePath,
  });
  if (insertError) throw new HttpError(500);
  return { statementId };
}

/** Resolves an opaque statement id to a 60-second signed URL - owner only. */
export async function signedStatementUrl(supabase: SupabaseClient, userId: string, statementId: string) {
  const { data: stmt } = await supabase
    .from("statements").select("storage_path, format, period_start")
    .eq("id", statementId).eq("customer_id", userId).maybeSingle();
  if (!stmt) throw new HttpError(404);
  const { data, error } = await supabase.storage.from("statements").createSignedUrl(stmt.storage_path, 60, {
    download: `acme-statement-${stmt.period_start}.${stmt.format}`,
  });
  if (error || !data) throw new HttpError(404);
  return data.signedUrl;
}
