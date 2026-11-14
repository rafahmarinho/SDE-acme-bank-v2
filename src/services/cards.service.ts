/**
 * Cards: block/unblock and daily limit changes (simulated cards; no PAN/CVV stored).
 * Ownership is enforced twice: the query filters customer_id = caller, and RLS (cards_owner_update)
 * rejects rows that are not the caller's. "Not yours" and "does not exist" both return 404 (T378).
 * Raising the limit or unblocking requires step-up authentication (checked by the caller, T338).
 * Every change is captured by the audit_cards trigger (T2602).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import type { AppRole } from "@/lib/supabase/server";

export const MAX_DAILY_LIMIT_CENTS = 1_000_000;

export const CardUpdate = z
  .object({
    status: z.enum(["active", "blocked"]).optional(),
    dailyLimitCents: z.number().int().min(0).max(MAX_DAILY_LIMIT_CENTS).optional(),
  })
  .refine((v) => v.status !== undefined || v.dailyLimitCents !== undefined, "Nothing to update");

export type CardSummary = {
  id: string; last4: string; status: "active" | "blocked"; daily_limit_cents: number; created_at: string; account_id: string;
  account: { name: string } | null; spent_today_cents: number;
};

export type CardAuthorization = {
  id: string; card_id: string; merchant: string; category: string; amount_cents: number; status: "approved" | "declined";
  decline_reason: string | null; at: string;
};

export async function listCards(supabase: SupabaseClient, userId: string, today: string): Promise<CardSummary[]> {
  const { data, error } = await supabase
    .from("cards").select("id, last4, status, daily_limit_cents, created_at, account_id, account:accounts(name)")
    .eq("customer_id", userId).order("created_at").limit(10);
  if (error) throw new HttpError(500);
  const ids = data.map((c) => c.id);
  const spent = new Map<string, number>();
  if (ids.length > 0) {
    const { data: auths, error: authErr } = await supabase
      .from("card_authorizations").select("card_id, amount_cents")
      .in("card_id", ids).eq("status", "approved").gte("at", `${today}T00:00:00Z`).limit(500);
    if (authErr) throw new HttpError(500);
    for (const a of auths) spent.set(a.card_id, (spent.get(a.card_id) ?? 0) + Number(a.amount_cents));
  }
  return (data as unknown as CardSummary[]).map((c) => ({ ...c, spent_today_cents: spent.get(c.id) ?? 0 }));
}

export async function recentAuthorizations(supabase: SupabaseClient, cardIds: string[], limit = 15): Promise<CardAuthorization[]> {
  if (cardIds.length === 0) return [];
  const { data, error } = await supabase
    .from("card_authorizations").select("id, card_id, merchant, category, amount_cents, status, decline_reason, at")
    .in("card_id", cardIds).order("at", { ascending: false }).limit(Math.min(limit, 50));
  if (error) throw new HttpError(500);
  return data as CardAuthorization[];
}

export async function getCard(supabase: SupabaseClient, userId: string, role: AppRole, cardId: string) {
  let query = supabase.from("cards").select("id, last4, status, daily_limit_cents, updated_at").eq("id", cardId);
  if (role === "customer") query = query.eq("customer_id", userId);
  const { data } = await query.maybeSingle();
  if (!data) throw new HttpError(404);
  return data;
}

/** Whether a change needs step-up auth: unblocking or raising the limit (blocking / lowering never does). */
export async function needsStepUp(supabase: SupabaseClient, userId: string, role: AppRole, cardId: string, input: z.infer<typeof CardUpdate>) {
  const card = await getCard(supabase, userId, role, cardId);
  return (input.status === "active" && card.status === "blocked") ||
    (input.dailyLimitCents !== undefined && input.dailyLimitCents > Number(card.daily_limit_cents));
}

export async function updateCard(
  supabase: SupabaseClient, userId: string, role: AppRole, cardId: string, input: z.infer<typeof CardUpdate>,
) {
  const patch: Record<string, unknown> = {};
  if (input.status) patch.status = input.status;
  if (input.dailyLimitCents !== undefined) patch.daily_limit_cents = input.dailyLimitCents;

  let query = supabase.from("cards").update(patch).eq("id", cardId);
  if (role !== "admin") query = query.eq("customer_id", userId); // session-derived id, never from the request
  const { data, error } = await query.select("id, last4, status, daily_limit_cents").maybeSingle();
  if (error) throw new HttpError(500);
  if (!data) throw new HttpError(404);
  return data;
}
