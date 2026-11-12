/**
 * Cards: block/unblock and daily limit changes (simulated cards; no PAN/CVV stored).
 * Ownership is enforced twice: the query filters customer_id = caller, and RLS (cards_owner_update)
 * rejects rows that are not the caller's. "Not yours" and "does not exist" both return 404.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import type { AppRole } from "@/lib/supabase/server";

export const CardUpdate = z
  .object({
    status: z.enum(["active", "blocked"]).optional(),
    dailyLimitCents: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((v) => v.status !== undefined || v.dailyLimitCents !== undefined, "Nothing to update");

export async function getCard(supabase: SupabaseClient, userId: string, role: AppRole, cardId: string) {
  let query = supabase.from("cards").select("id, last4, status, daily_limit_cents, updated_at").eq("id", cardId);
  if (role === "customer") query = query.eq("customer_id", userId);
  const { data } = await query.maybeSingle();
  if (!data) throw new HttpError(404);
  return data;
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
