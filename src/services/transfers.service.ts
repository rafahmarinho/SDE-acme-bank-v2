/**
 * Transfers: fee quote -> confirmation -> pending -> completed (settlement job).
 *
 * - Money movement happens only in PostgreSQL functions (quote_transfer / confirm_transfer) that derive
 *   the customer from auth.uid(), lock the account row, and check the balance (insufficient funds).
 * - The quote shown to the user (with its fee) is bound to the confirmation by an HMAC-signed,
 *   single-use, 5-minute token, so a forged cross-site request cannot confirm a transfer.
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { hmacSign, hmacVerify } from "@/lib/crypto";
import { HttpError } from "@/lib/errors";
import { adminClient } from "@/lib/supabase/admin";

export const QuoteRequest = z
  .object({
    fromAccountId: z.string().uuid(),
    amountCents: z.number().int().positive().max(100_000_000),
    toAccountId: z.string().uuid().optional(),
    beneficiaryId: z.string().uuid().optional(),
  })
  .refine((v) => Boolean(v.toAccountId) !== Boolean(v.beneficiaryId), "Choose exactly one destination");

export const ConfirmRequest = z.object({
  quoteId: z.string().uuid(),
  signature: z.string().min(20).max(100),
  reference: z.string().trim().max(140).optional(),
});

const DB_ERRORS: Record<string, [number, string]> = {
  insufficient_funds: [409, "Insufficient funds for this transfer, including fees."],
  quote_expired: [409, "This quote has expired. Please review the transfer again."],
  quote_not_found: [404, "Not found."],
  account_not_found: [404, "Not found."],
  beneficiary_not_found: [404, "Not found."],
  invalid_amount: [400, "Invalid amount."],
  invalid_destination: [400, "Invalid destination."],
  invalid_reference: [400, "The reference can have up to 140 characters."],
};

function mapDbError(message: string | undefined): never {
  const known = message ? DB_ERRORS[message] : undefined;
  if (known) throw new HttpError(known[0], known[1]);
  console.error("transfer error", message);
  throw new HttpError(500);
}

export async function quote(supabase: SupabaseClient, userId: string, input: z.infer<typeof QuoteRequest>) {
  const { data, error } = await supabase.rpc("quote_transfer", {
    p_from_account: input.fromAccountId,
    p_amount_cents: input.amountCents,
    p_to_account: input.toAccountId ?? null,
    p_beneficiary: input.beneficiaryId ?? null,
  });
  if (error) mapDbError(error.message);
  const row = (data as Array<{ quote_id: string; fee_cents: number; expires_at: string }>)[0]!;
  return {
    quoteId: row.quote_id,
    feeCents: row.fee_cents,
    totalCents: input.amountCents + row.fee_cents,
    expiresAt: row.expires_at,
    signature: hmacSign(`${userId}:${row.quote_id}`),
  };
}

export async function confirm(supabase: SupabaseClient, userId: string, input: z.infer<typeof ConfirmRequest>) {
  if (!hmacVerify(`${userId}:${input.quoteId}`, input.signature)) throw new HttpError(403);
  const { data, error } = await supabase.rpc("confirm_transfer", {
    p_quote_id: input.quoteId,
    p_reference: input.reference ?? null,
  });
  if (error) mapDbError(error.message);
  return { transferId: data as string, status: "pending" as const };
}

export const TRANSFER_STATUSES = ["pending", "completed", "failed", "cancelled"] as const;

export type TransferRow = {
  id: string; amount_cents: number; fee_cents: number; reference: string | null; status: string;
  created_at: string; settled_at: string | null;
  from: { name: string } | null; to: { name: string } | null; beneficiary: { nickname: string; bank_name: string } | null;
};

export async function listTransfers(supabase: SupabaseClient, userId: string, limit = 25, status?: string): Promise<TransferRow[]> {
  let q = supabase
    .from("transfers")
    .select("id, amount_cents, fee_cents, reference, status, created_at, settled_at, from:accounts!transfers_from_account_id_fkey(name), to:accounts!transfers_to_account_id_fkey(name), beneficiary:beneficiaries(nickname, bank_name)")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 50));
  if (status && (TRANSFER_STATUSES as readonly string[]).includes(status)) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) mapDbError(error.message);
  return data as unknown as TransferRow[];
}

/** Settlement job - called only from the CRON_SECRET-authenticated /api/jobs/settle route. */
export async function settlePendingTransfers() {
  const admin = adminClient();
  const [settled, scheduled] = await Promise.all([
    admin.rpc("settle_pending_transfers"),
    admin.rpc("execute_due_scheduled_payments"),
  ]);
  if (settled.error || scheduled.error) throw new Error("settlement failed");
  return { settled: settled.data as number, scheduledExecuted: scheduled.data as number };
}
