/**
 * Statement generation (CSV / PDF) and private storage.
 *
 * - Generated in memory; nothing is written to local disk or under public/ (T295, T214).
 * - Stored in the PRIVATE `statements` bucket at a server-generated path
 *   {customer_uuid}/{statement_uuid}.{format}; clients only ever see the statement UUID (T50).
 * - CSV cells are formula-injection safe (src/lib/csv.ts) (T214).
 * - PDF is rendered from React components with data passed as props (no template compilation
 *   of user-controlled strings, so no server-side template injection) (T1144).
 * - Format is an enum allow-list; the period is capped at 366 days and 10k rows (T42, T2600).
 */
import "server-only";
import { Document, Page, renderToBuffer, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createElement as h } from "react";
import { z } from "zod";
import { formatCents, toCsv } from "@/lib/csv";
import { HttpError } from "@/lib/errors";
import { newId } from "@/lib/ids";
import { formatMoney } from "@/lib/money";
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

type Row = { booked_at: string; description: string; amount_cents: number; direction: "debit" | "credit"; category: string };
type Meta = { accountName: string; accountMasked: string; holder: string; period: string; openingCents: number; closingCents: number; inCents: number; outCents: number };

const NAVY = "#13254a";
const ORANGE = "#f07a1a";
const styles = StyleSheet.create({
  page: { paddingTop: 36, paddingBottom: 48, paddingHorizontal: 36, fontSize: 9, color: "#1b2433", fontFamily: "Helvetica" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", borderBottomWidth: 2, borderBottomColor: ORANGE, paddingBottom: 10, marginBottom: 14 },
  brand: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY },
  brandAccent: { color: ORANGE },
  muted: { color: "#5b6576" },
  summary: { flexDirection: "row", gap: 8, marginBottom: 14 },
  box: { flexGrow: 1, borderWidth: 1, borderColor: "#dfe3ea", borderRadius: 4, padding: 8 },
  boxLabel: { fontSize: 8, color: "#5b6576", marginBottom: 3 },
  boxValue: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY },
  thead: { flexDirection: "row", backgroundColor: NAVY, color: "white", paddingVertical: 5, paddingHorizontal: 6, fontFamily: "Helvetica-Bold" },
  row: { flexDirection: "row", paddingVertical: 4, paddingHorizontal: 6, borderBottomWidth: 0.5, borderBottomColor: "#e6e9ef" },
  cDate: { width: 70 },
  cDesc: { flexGrow: 1, flexBasis: 0 },
  cCat: { width: 80 },
  cAmt: { width: 80, textAlign: "right" },
  footer: { position: "absolute", bottom: 20, left: 36, right: 36, fontSize: 7, color: "#8a93a3", flexDirection: "row", justifyContent: "space-between" },
});

const signed = (r: Row) => (r.direction === "debit" ? -r.amount_cents : r.amount_cents);

function StatementPdf({ meta, rows }: { meta: Meta; rows: Row[] }) {
  return h(Document, { title: `ACME Bank statement ${meta.period}`, author: "ACME Bank (simulation)" },
    h(Page, { size: "A4", style: styles.page },
      h(View, { style: styles.header },
        h(View, null,
          h(Text, { style: styles.brand }, "ACME ", h(Text, { style: styles.brandAccent }, "Bank")),
          h(Text, { style: styles.muted }, "Account statement - simulated data, no real money"),
        ),
        h(View, { style: { alignItems: "flex-end" } },
          h(Text, null, meta.holder),               // plain text nodes - never interpreted (T1144)
          h(Text, { style: styles.muted }, `${meta.accountName} ${meta.accountMasked}`),
          h(Text, { style: styles.muted }, meta.period),
        ),
      ),
      h(View, { style: styles.summary },
        ...([["Opening balance", meta.openingCents], ["Money in", meta.inCents], ["Money out", -meta.outCents], ["Closing balance", meta.closingCents]] as const).map(([label, v]) =>
          h(View, { key: label, style: styles.box }, h(Text, { style: styles.boxLabel }, label), h(Text, { style: styles.boxValue }, formatMoney(v))),
        ),
      ),
      h(View, { style: styles.thead, fixed: true },
        h(Text, { style: styles.cDate }, "Date"), h(Text, { style: styles.cDesc }, "Description"),
        h(Text, { style: styles.cCat }, "Category"), h(Text, { style: styles.cAmt }, "Amount"),
      ),
      ...(rows.length === 0 ? [h(Text, { key: "empty", style: { padding: 8, color: "#5b6576" } }, "No transactions in this period.")] : []),
      ...rows.map((r, i) =>
        h(View, { key: String(i), style: styles.row, wrap: false },
          h(Text, { style: styles.cDate }, r.booked_at.slice(0, 10)),
          h(Text, { style: styles.cDesc }, r.description),
          h(Text, { style: styles.cCat }, r.category),
          h(Text, { style: styles.cAmt }, formatMoney(signed(r))),
        ),
      ),
      h(View, { style: styles.footer, fixed: true },
        h(Text, null, "ACME Bank is a simulation. Keep this document private."),
        h(Text, { render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` }),
      ),
    ),
  );
}

async function sumBefore(supabase: SupabaseClient, accountId: string, before: string) {
  const { data, error } = await supabase
    .from("ledger_entries").select("amount_cents, direction").eq("account_id", accountId).lt("booked_at", before).limit(MAX_ROWS);
  if (error) throw new HttpError(500);
  return data.reduce((acc, r) => acc + (r.direction === "credit" ? Number(r.amount_cents) : -Number(r.amount_cents)), 0);
}

export async function generateStatement(supabase: SupabaseClient, userId: string, input: z.infer<typeof StatementRequest>) {
  // Ownership via the user-scoped client (RLS + explicit filter).
  const { data: account } = await supabase
    .from("accounts").select("id, name, account_number").eq("id", input.accountId).eq("customer_id", userId).maybeSingle();
  if (!account) throw new HttpError(404);
  const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle();

  const { data, error } = await supabase
    .from("ledger_entries")
    .select("booked_at, description, amount_cents, direction, category")
    .eq("account_id", input.accountId)
    .gte("booked_at", input.periodStart)
    .lte("booked_at", `${input.periodEnd}T23:59:59.999Z`)
    .order("booked_at")
    .limit(MAX_ROWS);
  if (error) throw new HttpError(500);
  const rows = (data as Row[]).map((r) => ({ ...r, amount_cents: Number(r.amount_cents) }));

  const openingCents = await sumBefore(supabase, input.accountId, input.periodStart);
  const inCents = rows.filter((r) => r.direction === "credit").reduce((a, r) => a + r.amount_cents, 0);
  const outCents = rows.filter((r) => r.direction === "debit").reduce((a, r) => a + r.amount_cents, 0);
  const meta: Meta = {
    accountName: account.name, accountMasked: `•••• ${String(account.account_number).slice(-4)}`,
    holder: profile?.full_name ?? "", period: `${input.periodStart} to ${input.periodEnd}`,
    openingCents, closingCents: openingCents + inCents - outCents, inCents, outCents,
  };

  let running = openingCents;
  const body =
    input.format === "csv"
      ? Buffer.from(toCsv(["Date", "Description", "Category", "Direction", "Amount", "Balance"], rows.map((r) => {
          running += signed(r);
          return [r.booked_at.slice(0, 10), r.description, r.category, r.direction, formatCents(signed(r)), formatCents(running)];
        })), "utf8")
      : await renderToBuffer(StatementPdf({ meta, rows }));

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

export async function listStatements(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("statements").select("id, account_id, period_start, period_end, format, created_at, account:accounts(name)")
    .eq("customer_id", userId).order("created_at", { ascending: false }).limit(50);
  if (error) throw new HttpError(500);
  return data as unknown as Array<{ id: string; account_id: string; period_start: string; period_end: string; format: "csv" | "pdf"; created_at: string; account: { name: string } | null }>;
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
