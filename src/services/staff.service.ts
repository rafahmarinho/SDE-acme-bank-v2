/**
 * Staff panel data (support + admin). Every call uses the caller's RLS-scoped client and SECURITY
 * DEFINER functions that re-check the role in SQL (T2598):
 *   - customer lookup: >= 3 characters, max 20 rows, masked phone (T2600, T2139),
 *   - dashboard figures and daily activity: aggregated, no identifiers (T544),
 *   - audit log: admin only, metadata + changed column names, no values (T349).
 * Responses are validated with zod so unexpected columns are stripped.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";

export const CustomerSummary = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  email: z.string(),
  phone_masked: z.string().nullable(),
  account_count: z.coerce.number(),
});

const CustomerDetail = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  email: z.string(),
  phone_masked: z.string().nullable(),
  city: z.string().nullable(),
  created_at: z.string(),
  is_demo: z.boolean(),
  role: z.enum(["customer", "support", "admin"]).catch("customer"),
  restrictions: z.array(z.string()),
});

const Stats = z.object({
  customers: z.coerce.number(), accounts: z.coerce.number(), deposits_cents: z.coerce.number(),
  pending_transfers: z.coerce.number(), open_tickets: z.coerce.number(), blocked_cards: z.coerce.number(),
  declined_today: z.coerce.number(), sim_date: z.string(),
});

export async function dashboardStats(supabase: SupabaseClient) {
  const { data, error } = await supabase.rpc("staff_dashboard_stats");
  if (error) throw new HttpError(500);
  return Stats.parse((data as unknown[])[0]);
}

export async function activityDaily(supabase: SupabaseClient, days = 14) {
  const { data, error } = await supabase.rpc("staff_activity_daily", { p_days: days });
  if (error) throw new HttpError(500);
  return z.array(z.object({ day: z.string(), direction: z.enum(["debit", "credit"]), entries: z.coerce.number(), total_cents: z.coerce.number() })).parse(data);
}

export async function searchCustomers(supabase: SupabaseClient, q: string) {
  const term = q.trim();
  if (term.length < 3 || term.length > 100) return [];
  const { data, error } = await supabase.rpc("staff_search_customers", { p_query: term });
  if (error) {
    console.error("staff lookup failed", error.code);
    throw new HttpError(500, "Search failed.");
  }
  return z.array(CustomerSummary).max(20).parse(data);
}

export async function customerDetail(supabase: SupabaseClient, customerId: string) {
  const { data, error } = await supabase.rpc("staff_customer_detail", { p_customer: customerId });
  if (error) throw new HttpError(500);
  const row = (data as unknown[])[0];
  if (!row) throw new HttpError(404);
  const profile = CustomerDetail.parse(row);

  const [accounts, balances, cards, ledger, transfers] = await Promise.all([
    supabase.from("accounts").select("id, name, kind, account_number, status").eq("customer_id", customerId).limit(10),
    supabase.from("account_balances").select("account_id, balance_cents").eq("customer_id", customerId).limit(10),
    supabase.from("cards").select("id, last4, status, daily_limit_cents, account_id").eq("customer_id", customerId).limit(10),
    supabase.from("ledger_entries")
      .select("id, booked_at, description, amount_cents, direction, category, account:accounts!inner(customer_id)")
      .eq("account.customer_id", customerId).order("booked_at", { ascending: false }).limit(15),
    supabase.from("transfers").select("id, amount_cents, fee_cents, status, reference, created_at")
      .eq("customer_id", customerId).order("created_at", { ascending: false }).limit(10),
  ]);
  if (accounts.error || balances.error || cards.error || ledger.error || transfers.error) throw new HttpError(500);
  const bal = new Map(balances.data.map((b) => [b.account_id as string, Number(b.balance_cents)]));
  return {
    profile,
    accounts: accounts.data.map((a) => ({ ...a, account_number: `•••• ${String(a.account_number).slice(-4)}`, balance_cents: bal.get(a.id) ?? 0 })),
    cards: cards.data,
    ledger: ledger.data.map(({ account: _a, ...rest }) => rest) as Array<{ id: string; booked_at: string; description: string; amount_cents: number; direction: "debit" | "credit"; category: string }>,
    transfers: transfers.data,
  };
}

export const AuditFilter = z.object({
  table: z.enum(["event", "cards", "transfers", "ledger_entries", "profiles", "beneficiaries", "scheduled_payments", "consents", "processing_restrictions", "statements", "accounts", "card_authorizations"]).optional(),
});

export async function auditLog(supabase: SupabaseClient, table?: string, limit = 100) {
  const { data, error } = await supabase.rpc("admin_audit_log", { p_limit: limit, p_table: table ?? null });
  if (error) throw new HttpError(error.code === "42501" ? 403 : 500);
  return z.array(z.object({
    id: z.coerce.number(), at: z.string(), actor: z.string().nullable(), actor_role: z.string().nullable(),
    table_name: z.string(), op: z.string(), row_id: z.string().nullable(), changed: z.array(z.string()).nullable(),
  })).parse(data);
}
