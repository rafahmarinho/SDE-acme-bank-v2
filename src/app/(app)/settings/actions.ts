"use server";
/**
 * Settings actions: optional consent toggles (withdrawal as easy as granting).
 * Required consents (terms, privacy notice) cannot be withdrawn here - closing the account handles that.
 */
import { revalidatePath } from "next/cache";
import { authorize } from "@/lib/authz";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { ConsentUpdate, updateConsent } from "@/services/privacy.service";

export async function setConsentAction(form: FormData) {
  const { user, supabase } = await authorize("consents", "PATCH");
  await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
  const input = ConsentUpdate.parse({ purpose: form.get("purpose"), granted: form.get("granted") === "true" });
  await updateConsent(supabase, user.id, input);
  revalidatePath("/settings");
}
