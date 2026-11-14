"use server";
/**
 * Simulated account opening.
 *  - Consent step is separate from the Terms of Service; optional consents default to OFF (T178).
 *  - Required consents (terms + privacy notice) must be given; they are recorded with the notice version
 *    and a timestamp BEFORE any personal data is stored (public.open_customer_account()).
 *  - Only the data needed to operate the account is collected (no date of birth / national ID).
 *  - Duplicate customers are rejected (unique email) without revealing whether an email exists:
 *    success and "already registered" end on the same screen (T742, T2).
 *  - Identity / email verification is a simulated integration (PRD): the address is marked confirmed.
 *    Hosted production deployments should switch to a real confirmation email (docs/security.md).
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { fieldErrorsOf } from "@/lib/action";
import { rateLimit } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { PasswordSchema } from "@/services/auth.service";
import { PRIVACY_NOTICE_VERSION } from "@/services/privacy.service";

const OpenAccount = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(254),
  password: PasswordSchema,
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number."),
  address_line1: z.string().trim().min(1, "Enter your street address.").max(200),
  city: z.string().trim().min(1, "Enter your city.").max(100),
  postal_code: z.string().trim().min(1, "Enter your postal code.").max(20),
  terms: z.literal("on", { error: "Please accept the Terms of Service." }),
  privacy_notice: z.literal("on", { error: "Please confirm you have read the Privacy Notice." }),
  marketing_email: z.literal("on").optional(),
  product_analytics: z.literal("on").optional(),
});

export type OpenAccountState = { ok: boolean; message?: string; fieldErrors?: Record<string, string> } | null;

export async function openAccountAction(_prev: OpenAccountState, form: FormData): Promise<OpenAccountState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  try {
    await rateLimit(`open-account:${ip}`, { max: 5, windowSec: 3600 });
  } catch {
    return { ok: false, message: "Too many attempts. Please try again later." };
  }

  const parsed = OpenAccount.safeParse(Object.fromEntries(form));
  if (!parsed.success) {
    return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
  }
  const d = parsed.data;
  const admin = adminClient();
  const { data: created, error } = await admin.auth.admin.createUser({
    email: d.email,
    password: d.password,
    email_confirm: true, // simulated identity/email verification (see header)
    app_metadata: { role: "customer" },
  });
  if (error || !created.user) redirect("/login?opened=1"); // includes "already registered" - no enumeration

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
  await admin.rpc("audit_event", { p_event: "account_opened", p_details: { user_id: created.user.id } });
  redirect("/login?opened=1");
}
