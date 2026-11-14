"use server";
/**
 * Settings actions.
 *  - Optional consent toggles: withdrawal is as easy as granting and takes effect immediately (T604).
 *    Required consents (terms, privacy notice) cannot be withdrawn here - closing the account handles that.
 *  - Step-up re-authentication used by sensitive actions across the app (T338).
 *  - Password change: requires the current password, applies the password policy and revokes all
 *    other sessions (T2, T20). Sign-out of other devices.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { setNewPassword } from "@/services/auth.service";
import { ConsentUpdate, updateConsent } from "@/services/privacy.service";
import { verifyStepUp } from "@/services/step-up.service";

export async function setConsentAction(form: FormData) {
  const { user, supabase } = await authorize("consents", "PATCH");
  await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
  const input = ConsentUpdate.parse({ purpose: form.get("purpose"), granted: form.get("granted") === "true" });
  await updateConsent(supabase, user.id, input);
  revalidatePath("/settings");
}

export async function stepUpAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await authorize("security", "POST");
    const password = z.string().min(1).max(128).safeParse(form.get("password"));
    if (!password.success) return { ok: false, message: "Enter your password." };
    const ok = await verifyStepUp(user, password.data);
    return ok ? { ok: true } : { ok: false, message: "That password isn't right. Please try again." };
  });
}

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await authorize("security", "PATCH");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const current = String(form.get("current") ?? "");
    const next = String(form.get("password") ?? "");
    if (next !== form.get("confirm")) return { ok: false, message: "The new passwords do not match." };
    if (next === current) return { ok: false, message: "Choose a password you haven't used here." };
    if (!(await verifyStepUp(user, current))) return { ok: false, message: "Your current password isn't right." };
    const result = await setNewPassword({ password: next });
    if (!result.ok) return { ok: false, message: result.message };
    return { ok: true, message: "Password updated. You were signed out on your other devices." };
  });
}

export async function signOutOthersAction(_prev: ActionState): Promise<ActionState> {
  return runAction(async () => {
    const { user, supabase } = await authorize("security", "DELETE");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    if (error) return { ok: false, message: "We couldn't sign out your other devices. Try again." };
    return { ok: true, message: "You were signed out on all other devices." };
  });
}
