/**
 * Accounts and ledger queries (amounts in cents).
 *
 * - All values are bound by the supabase-js query builder (PostgREST parameters); no SQL strings,
 *   no `.or()` / `.filter()` strings built from input. Filters are validated against enums first (T38).
 * - LIKE wildcards in the search term are escaped.
 * - Every list is paginated with a hard server-side maximum, whatever the client asks for (T2600).
 * - Queries always filter by the caller's id in addition to RLS (staff have broader RLS read access,
 *   so customer screens must not rely on RLS alone to scope "my" data; T378).
 * - Columns are always named explicitly (no select *; T2139).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";

export const PAGE_MAX = 50;

export const LEDGER_CATEGORIES = [
  "groceries", "dining", "transport", "shopping", "utilities", "entertainment", "health",
  "salary", "deposit", "transfer", "fee", "rent", "other",
] as const;

export const LedgerSearch = z.object({
  accountId: z.string().uuid(),
  text: z.string().trim().max(100).optional(),
  direction: z.enum(["debit", "credit"]).optional(),
  category: z.enum(LEDGER_CATEGORIES).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(25),
  cursor: z.string().datetime({ offset: true }).optional(), // keyset pagination on booked_at
});

export const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

export type Account = {
  id: string; name: string; kind: "checking" | "savings"; account_number: string; status: string;
  created_at: string; balance_cents: number; pending_out_cents: number;
};

export type LedgerRow = {
  id: string; booked_at: string; description: string; amount_cents: number; direction: "debit" | "credit";
  category: string; transfer_id: string | null; card_id: string | null; account_id: string;
  transfer: { status: string } | null;
};

const LEDGER_COLUMNS = "id, booked_at, description, amount_cents, direction, category, transfer_id, card_id, account_id, transfer:transfers(status)";

export async function listAccounts(supabase: SupabaseClient, userId: string): Promise<Account[]> {
  const [accounts, balances, pending] = await Promise.all([
    supabase.from("accounts").select("id, name, kind, account_number, status, created_at").eq("customer_id", userId).order("created_at").limit(10),
    supabase.from("account_balances").select("account_id, balance_cents").eq("customer_id", userId).limit(10),
    supabase.from("transfers").select("from_account_id, amount_cents, fee_cents").eq("customer_id", userId).eq("status", "pending").limit(PAGE_MAX),
  ]);
  if (accounts.error || balances.error || pending.error) throw new HttpError(500);
  const bal = new Map(balances.data.map((b) => [b.account_id as string, Number(b.balance_cents)]));
  const pend = new Map<string, number>();
  for (const p of pending.data) pend.set(p.from_account_id, (pend.get(p.from_account_id) ?? 0) + Number(p.amount_cents) + Number(p.fee_cents));
  return accounts.data.map((a) => ({ ...a, balance_cents: bal.get(a.id) ?? 0, pending_out_cents: pend.get(a.id) ?? 0 })) as Account[];
}

export async function getAccount(supabase: SupabaseClient, userId: string, accountId: string) {
  const accounts = await listAccounts(supabase, userId);
  const account = accounts.find((a) => a.id === accountId);
  if (!account) throw new HttpError(404);
  return account;
}

export async function searchLedger(supabase: SupabaseClient, userId: string, raw: unknown) {
  const q = LedgerSearch.parse(raw);

  // Ownership check first (404 for accounts that are not the caller's).
  const { data: account } = await supabase
    .from("accounts").select("id").eq("id", q.accountId).eq("customer_id", userId).maybeSingle();
  if (!account) throw new HttpError(404);

  let query = supabase
    .from("ledger_entries")
    .select(LEDGER_COLUMNS)
    .eq("account_id", q.accountId)
    .order("booked_at", { ascending: false })
    .limit(q.limit);

  if (q.text) query = query.ilike("description", `%${escapeLike(q.text)}%`);
  if (q.direction) query = query.eq("direction", q.direction);
  if (q.category) query = query.eq("category", q.category);
  if (q.from) query = query.gte("booked_at", q.from);
  if (q.to) query = query.lte("booked_at", `${q.to}T23:59:59.999Z`);
  if (q.cursor) query = query.lt("booked_at", q.cursor);

  const { data, error } = await query;
  if (error) throw new HttpError(500);
  const entries = data as unknown as LedgerRow[];
  const nextCursor = entries.length === q.limit ? entries[entries.length - 1]!.booked_at : null;
  return { entries, nextCursor };
}

/** Latest entries across all of the caller's accounts. */
export async function recentActivity(supabase: SupabaseClient, accountIds: string[], limit = 8): Promise<LedgerRow[]> {
  if (accountIds.length === 0) return [];
  const { data, error } = await supabase
    .from("ledger_entries").select(LEDGER_COLUMNS)
    .in("account_id", accountIds).order("booked_at", { ascending: false }).limit(Math.min(limit, PAGE_MAX));
  if (error) throw new HttpError(500);
  return data as unknown as LedgerRow[];
}

/** Money in / out and spending per category since a date (bounded to 1000 rows). */
export async function cashflowSince(supabase: SupabaseClient, accountIds: string[], since: string) {
  if (accountIds.length === 0) return { inCents: 0, outCents: 0, byCategory: [] as Array<{ category: string; cents: number }> };
  const { data, error } = await supabase
    .from("ledger_entries").select("amount_cents, direction, category, transfer_id")
    .in("account_id", accountIds).gte("booked_at", since).limit(1000);
  if (error) throw new HttpError(500);
  let inCents = 0;
  let outCents = 0;
  const cat = new Map<string, number>();
  for (const r of data) {
    const amt = Number(r.amount_cents);
    if (r.direction === "credit") inCents += amt;
    else {
      outCents += amt;
      if (r.category !== "transfer") cat.set(r.category, (cat.get(r.category) ?? 0) + amt);
    }
  }
  const byCategory = [...cat.entries()].map(([category, cents]) => ({ category, cents })).sort((a, b) => b.cents - a.cents);
  return { inCents, outCents, byCategory };
}

export async function appToday(supabase: SupabaseClient): Promise<string> {
  const { data, error } = await supabase.rpc("app_today");
  if (error || typeof data !== "string") return new Date().toISOString().slice(0, 10);
  return data;
}

export const OpenAccountRequest = z.object({
  kind: z.enum(["checking", "savings"]),
  name: z.string().trim().min(1, "Give the account a name.").max(40),
});

export async function openAdditionalAccount(supabase: SupabaseClient, input: z.infer<typeof OpenAccountRequest>) {
  const { data, error } = await supabase.rpc("open_additional_account", { p_kind: input.kind, p_name: input.name });
  if (error) {
    if (error.message === "account_limit") throw new HttpError(409, "You can have up to 4 open accounts.");
    throw new HttpError(500);
  }
  return data as string;
}
