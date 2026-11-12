/**
 * Privacy controls:
 *   - Consent: required consents are recorded at account opening; optional ones can be withdrawn at any
 *     time from Settings (append-only consent_events history with notice version).
 *   - Restriction of processing: services must call assertProcessingAllowed() before an optional
 *     processing activity (marketing email, analytics, staff bulk export).
 *   - Pseudonymisation: simulated external integrations and event payloads use pseudonymFor(); the
 *     mapping lives in private.customer_pseudonyms (not exposed via the API; service role only).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { adminClient } from "@/lib/supabase/admin";

export const PRIVACY_NOTICE_VERSION = "2026-11";

export const OPTIONAL_PURPOSES = ["marketing_email", "product_analytics"] as const;
export type OptionalPurpose = (typeof OPTIONAL_PURPOSES)[number];

export const ConsentUpdate = z.object({ purpose: z.enum(OPTIONAL_PURPOSES), granted: z.boolean() });

export async function listConsents(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("consents").select("purpose, granted, notice_version, updated_at").eq("user_id", userId);
  if (error) throw new HttpError(500);
  return data;
}

/** Withdraw or grant an optional consent; takes effect immediately for every service. */
export async function updateConsent(supabase: SupabaseClient, userId: string, input: z.infer<typeof ConsentUpdate>) {
  const row = { user_id: userId, purpose: input.purpose, granted: input.granted, notice_version: PRIVACY_NOTICE_VERSION, updated_at: new Date().toISOString() };
  const { error } = await supabase.from("consents").upsert(row, { onConflict: "user_id,purpose" });
  if (error) throw new HttpError(500);
  const { error: evError } = await supabase.from("consent_events").insert({
    user_id: userId, purpose: input.purpose, granted: input.granted, notice_version: PRIVACY_NOTICE_VERSION,
  });
  if (evError) throw new HttpError(500);
}

export type ProcessingActivity = OptionalPurpose | "staff_bulk_export";

export class ProcessingRestrictedError extends Error {
  constructor(public readonly activity: ProcessingActivity) {
    super(`processing restricted: ${activity}`);
  }
}

/** Throws when the customer withdrew consent or objected to this processing activity. */
export async function assertProcessingAllowed(userId: string, activity: ProcessingActivity) {
  const admin = adminClient();
  const { data: restrictions } = await admin
    .from("processing_restrictions").select("activity").eq("user_id", userId)
    .in("activity", [activity, "all_non_essential"]);
  if (restrictions && restrictions.length > 0) throw new ProcessingRestrictedError(activity);
  if (activity === "marketing_email" || activity === "product_analytics") {
    const { data: consent } = await admin
      .from("consents").select("granted").eq("user_id", userId).eq("purpose", activity).maybeSingle();
    if (!consent?.granted) throw new ProcessingRestrictedError(activity);
  }
}

export const RestrictionRequest = z.object({
  userId: z.string().uuid(),
  activity: z.enum(["marketing_email", "product_analytics", "staff_bulk_export", "all_non_essential"]),
});

/** Support/admin record a customer's objection (RLS: staff insert with created_by = caller). */
export async function recordRestriction(supabase: SupabaseClient, staffId: string, input: z.infer<typeof RestrictionRequest>) {
  const { error } = await supabase.from("processing_restrictions").upsert(
    { user_id: input.userId, activity: input.activity, created_by: staffId },
    { onConflict: "user_id,activity", ignoreDuplicates: true },
  );
  if (error) throw new HttpError(500);
}

/** Pseudonym for a customer, for simulated integrations and event payloads (never names/emails). */
export async function pseudonymFor(customerId: string): Promise<string> {
  const { data, error } = await adminClient().rpc("customer_pseudonym", { p_customer_id: customerId });
  if (error || !data) throw new HttpError(500);
  return data as string;
}
