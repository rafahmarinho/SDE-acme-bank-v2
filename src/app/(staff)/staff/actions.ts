"use server";
/**
 * Staff actions. Each re-authorizes by role (T184), validates ids, and is audited by triggers or
 * audit_event (T2602).
 *  - Support/admin: record a customer's objection to a processing activity (T754).
 *  - Admin only: block/unblock a customer's card or change its limit; change a user's role. Role
 *    changes need step-up auth, cannot target yourself, and revoke the target's sessions (T20).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { parseAmountToCents } from "@/lib/money";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { setUserRole } from "@/services/auth.service";
import { MAX_DAILY_LIMIT_CENTS, updateCard } from "@/services/cards.service";
import { recordRestriction, RestrictionRequest } from "@/services/privacy.service";
import { hasRecentStepUp } from "@/services/step-up.service";

export async function recordRestrictionAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, supabase } = await authorize("staff/restrictions", "POST");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const input = RestrictionRequest.parse({ userId: form.get("userId"), activity: form.get("activity") });
    await recordRestriction(supabase, user.id, input);
    revalidatePath(`/staff/customers/${input.userId}`);
    return { ok: true, message: "Restriction recorded. Services stop this processing immediately." };
  });
}

export async function adminCardAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, role, supabase } = await authorize("cards/:id", "PATCH");
    if (role !== "admin") return { ok: false, message: "Only administrators can change customer cards." };
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const cardId = z.string().uuid().parse(form.get("cardId"));
    const customerId = z.string().uuid().parse(form.get("customerId"));
    const intent = z.enum(["block", "unblock", "limit"]).parse(form.get("intent"));
    if (intent === "limit") {
      const cents = parseAmountToCents(form.get("limit")?.toString());
      if (cents === null || cents > MAX_DAILY_LIMIT_CENTS) return { ok: false, message: "Choose a limit up to $10,000." };
      await updateCard(supabase, user.id, role, cardId, { dailyLimitCents: cents });
    } else {
      await updateCard(supabase, user.id, role, cardId, { status: intent === "block" ? "blocked" : "active" });
    }
    revalidatePath(`/staff/customers/${customerId}`);
    return { ok: true, message: intent === "limit" ? "Limit updated." : intent === "block" ? "Card blocked." : "Card unblocked." };
  });
}

export async function setRoleAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user } = await authorize("users:role", "PATCH");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const target = z.string().uuid().parse(form.get("userId"));
    const role = z.enum(["customer", "support", "admin"]).parse(form.get("role"));
    if (target === user.id) return { ok: false, message: "You can't change your own role." };
    if (!(await hasRecentStepUp(user.id))) return { ok: false, stepUp: true };
    await setUserRole(target, role, user.id);
    revalidatePath(`/staff/customers/${target}`);
    return { ok: true, message: "Role updated. The user was signed out so the new role takes effect." };
  });
}
