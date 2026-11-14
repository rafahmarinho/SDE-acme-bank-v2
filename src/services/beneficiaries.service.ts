/**
 * Beneficiaries (payees). Owner-only by RLS and by explicit customer_id filters (T378).
 * Nicknames and bank names are length-limited and rendered as text by React (T36); account numbers
 * are validated as 11 digits. Search uses the query builder with escaped LIKE wildcards (T38).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { escapeLike } from "@/services/accounts.service";

export const BeneficiaryInput = z.object({
  nickname: z.string().trim().min(1, "Enter a name for this payee.").max(60),
  bank_name: z.string().trim().min(1, "Enter the bank name.").max(80),
  account_number: z.string().trim().regex(/^[0-9]{11}$/, "Account numbers have 11 digits."),
});

export type Beneficiary = { id: string; nickname: string; bank_name: string; account_number: string; created_at: string };

export async function listBeneficiaries(supabase: SupabaseClient, userId: string, search?: string): Promise<Beneficiary[]> {
  let q = supabase
    .from("beneficiaries").select("id, nickname, bank_name, account_number, created_at")
    .eq("customer_id", userId).order("nickname").limit(50);
  const term = search?.trim().slice(0, 60);
  if (term) q = q.ilike("nickname", `%${escapeLike(term)}%`);
  const { data, error } = await q;
  if (error) throw new HttpError(500);
  return data;
}

export async function createBeneficiary(supabase: SupabaseClient, userId: string, input: z.infer<typeof BeneficiaryInput>) {
  const { count } = await supabase.from("beneficiaries").select("id", { count: "exact", head: true }).eq("customer_id", userId);
  if ((count ?? 0) >= 50) throw new HttpError(409, "You can save up to 50 beneficiaries.");
  const { data: duplicate } = await supabase
    .from("beneficiaries").select("id").eq("customer_id", userId).eq("account_number", input.account_number).maybeSingle();
  if (duplicate) throw new HttpError(409, "This account is already in your beneficiaries.");
  const { error } = await supabase.from("beneficiaries").insert({ ...input, customer_id: userId });
  if (error) throw new HttpError(500);
}

export async function deleteBeneficiary(supabase: SupabaseClient, userId: string, id: string) {
  const { data: inUse } = await supabase
    .from("scheduled_payments").select("id").eq("customer_id", userId).eq("beneficiary_id", id).eq("status", "scheduled").limit(1);
  if (inUse && inUse.length > 0) throw new HttpError(409, "Cancel the scheduled payments to this beneficiary first.");
  const { data: used } = await supabase.from("transfers").select("id").eq("customer_id", userId).eq("beneficiary_id", id).limit(1);
  if (used && used.length > 0) throw new HttpError(409, "This beneficiary has payment history and can't be removed.");
  const { data, error } = await supabase.from("beneficiaries").delete().eq("id", id).eq("customer_id", userId).select("id");
  if (error) throw new HttpError(500);
  if (!data || data.length === 0) throw new HttpError(404);
}
