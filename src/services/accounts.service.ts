/**
 * Accounts and ledger queries (amounts in cents).
 *
 * - All values are bound by the supabase-js query builder (PostgREST parameters); no SQL strings,
 *   no `.or()` / `.filter()` strings built from input. Filters are validated against enums first.
 * - LIKE wildcards in the search term are escaped.
 * - Every list is paginated with a hard server-side maximum, whatever the client asks for.
 * - Queries always filter by the caller's id in addition to RLS (staff have broader RLS read access,
 *   so customer screens must not rely on RLS alone to scope "my" data).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";

export const PAGE_MAX = 50;

export const LedgerSearch = z.object({
  accountId: z.string().uuid(),
  text: z.string().trim().max(100).optional(),
  direction: z.enum(["debit", "credit"]).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(PAGE_MAX).default(25),
  cursor: z.string().datetime({ offset: true }).optional(), // keyset pagination on booked_at
});

export const escapeLike = (term: string) => term.replace(/[\\%_]/g, (c) => `\\${c}`);

export async function listAccounts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("account_balances")
    .select("account_id, balance_cents")
    .eq("customer_id", userId)
    .limit(10);
  if (error) throw new HttpError(500);
  return data;
}

export async function searchLedger(supabase: SupabaseClient, userId: string, raw: unknown) {
  const q = LedgerSearch.parse(raw);

  // Ownership check first (404 for accounts that are not the caller's).
  const { data: account } = await supabase
    .from("accounts").select("id").eq("id", q.accountId).eq("customer_id", userId).maybeSingle();
  if (!account) throw new HttpError(404);

  let query = supabase
    .from("ledger_entries")
    .select("id, booked_at, description, amount_cents, direction, transfer_id")
    .eq("account_id", q.accountId)
    .order("booked_at", { ascending: false })
    .limit(q.limit);

  if (q.text) query = query.ilike("description", `%${escapeLike(q.text)}%`);
  if (q.direction) query = query.eq("direction", q.direction);
  if (q.from) query = query.gte("booked_at", q.from);
  if (q.to) query = query.lte("booked_at", `${q.to}T23:59:59.999Z`);
  if (q.cursor) query = query.lt("booked_at", q.cursor);

  const { data, error } = await query;
  if (error) throw new HttpError(500);
  const nextCursor = data.length === q.limit ? data[data.length - 1]!.booked_at : null;
  return { entries: data, nextCursor };
}
