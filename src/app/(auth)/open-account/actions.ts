"use server";
/**
 * Simulated account opening.
 *  - Consent step is separate from the Terms of Service; optional consents default to OFF.
 *  - Required consents (terms + privacy notice) must be given; they are recorded with the notice version
 *    and a timestamp BEFORE any personal data is stored (public.open_customer_account()).
 *  - Only the data needed to operate the account is collected (no date of birth / national ID).
 *  - Duplicate customers are rejected (unique email), without revealing whether an email exists.
 */
import { headers } from "next/headers";
import { z } from "zod";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { PasswordSchema } from "@/services/auth.service";
import { PRIVACY_NOTICE_VERSION } from "@/services/privacy.service";

const OpenAccount = z.object({
  full_name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password: PasswordSchema,
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/),
  address_line1: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(100),
  postal_code: z.string().trim().min(1).max(20),
  terms: z.literal("on"),
  privacy_notice: z.literal("on"),
  marketing_email: z.literal("on").optional(),
  product_analytics: z.literal("on").optional(),
});

export type OpenAccountState = { ok: boolean; message?: string } | null;

const GENERIC_DONE = { ok: true, message: "Thanks! If the details are valid, your account is ready - sign in to continue." };

export async function openAccountAction(_prev: OpenAccountState, form: FormData): Promise<OpenAccountState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  await rateLimit(`open-account:${ip}`, { max: 5, windowSec: 3600 });

  const parsed = OpenAccount.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    const consentMissing = parsed.error.issues.some((i) => i.path[0] === "terms" || i.path[0] === "privacy_notice");
    return { ok: false, message: consentMissing ? "Please accept the Terms of Service and the Privacy Notice." : "Please check the highlighted fields." };
  }
  const d = parsed.data;
  const admin = adminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: false, // confirmation email proves ownership of the address
    app_metadata: { role: "customer" },
  });
  if (error || !created.user) return GENERIC_DONE; // includes "already registered" - no enumeration

  const { error: openError } = await admin.rpc("open_customer_account", {
    p_user_id: created.user.id,
    p_full_name: d.full_name,
    p_email: d.email,
    p_phone: d.phone,
    p_address_line1: d.address_line1,
    p_city: d.city,
    p_postal_code: d.postal_code,
    p_notice_version: PRIVACY_NOTICE_VERSION,
    p_marketing_email: d.marketing_email === "on",
    p_product_analytics: d.product_analytics === "on",
  });
  if (openError) {
    await admin.auth.admin.deleteUser(created.user.id); // roll back the half-created user
    return { ok: false, message: "We could not open your account. Please try again." };
  }
  return GENERIC_DONE;
}
