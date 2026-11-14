/**
 * Scheduled payments: future one-off or monthly payments from the caller's account to the caller's
 * beneficiary. RLS (scheduled_insert) re-checks ownership of both and that the date is in the
 * simulated future; customers may only cancel (status column grant + scheduled_cancel policy).
 * Execution happens in public.execute_due_scheduled_payments() (settlement job / simulation clock).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";

export const ScheduleInput = z.object({
  fromAccountId: z.string().uuid(),
  beneficiaryId: z.string().uuid(),
  amountCents: z.number().int().positive().max(100_000_000),
  executeOn: z.string().date(),
  frequency: z.enum(["once", "monthly"]),
  reference: z.string().trim().max(140).optional(),
});

export type ScheduledPayment = {
  id: string; amount_cents: number; reference: string | null; execute_on: string; status: string; frequency: string;
  beneficiary: { nickname: string; bank_name: string } | null; account: { name: string } | null;
};

export async function listScheduled(supabase: SupabaseClient, userId: string, status?: string): Promise<ScheduledPayment[]> {
  let q = supabase
    .from("scheduled_payments")
    .select("id, amount_cents, reference, execute_on, status, frequency, beneficiary:beneficiaries(nickname, bank_name), account:accounts(name)")
    .eq("customer_id", userId)
    .order("execute_on", { ascending: status !== "history" })
    .limit(50);
  if (status === "history") q = q.neq("status", "scheduled");
  else q = q.eq("status", "scheduled");
  const { data, error } = await q;
  if (error) throw new HttpError(500);
  return data as unknown as ScheduledPayment[];
}

export async function createScheduled(supabase: SupabaseClient, userId: string, input: z.infer<typeof ScheduleInput>) {
  const { data: today } = await supabase.rpc("app_today");
  if (typeof today === "string" && input.executeOn <= today) throw new HttpError(400, "Choose a date after today.");
  const max = new Date(`${typeof today === "string" ? today : new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  max.setUTCFullYear(max.getUTCFullYear() + 1);
  if (input.executeOn > max.toISOString().slice(0, 10)) throw new HttpError(400, "Payments can be scheduled up to one year ahead.");

  const { data, error } = await supabase
    .from("scheduled_payments")
    .insert({
      customer_id: userId,
      from_account_id: input.fromAccountId,
      beneficiary_id: input.beneficiaryId,
      amount_cents: input.amountCents,
      execute_on: input.executeOn,
      frequency: input.frequency,
      reference: input.reference || null,
    })
    .select("id, execute_on, status")
    .single();
  if (error) throw new HttpError(404); // RLS rejects foreign accounts/beneficiaries
  return data;
}

export async function cancelScheduled(supabase: SupabaseClient, userId: string, id: string) {
  const { data } = await supabase
    .from("scheduled_payments")
    .update({ status: "cancelled" })
    .eq("id", id).eq("customer_id", userId).eq("status", "scheduled")
    .select("id, status")
    .maybeSingle();
  if (!data) throw new HttpError(404);
  return data;
}

/** Fee preview from the single SQL source of truth (public.fee_for). */
export async function feeFor(supabase: SupabaseClient, amountCents: number, external: boolean): Promise<number> {
  const { data, error } = await supabase.rpc("fee_for", { p_amount_cents: amountCents, p_external: external });
  if (error) throw new HttpError(500);
  return Number(data);
}
