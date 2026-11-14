"use server";
/**
 * Card actions (customer). Blocking and lowering the limit are instant; unblocking and raising the
 * limit need step-up authentication (T338). Ownership: session user + RLS (T378). Audited by trigger.
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { parseAmountToCents } from "@/lib/money";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { CardUpdate, MAX_DAILY_LIMIT_CENTS, needsStepUp, updateCard } from "@/services/cards.service";
import { hasRecentStepUp } from "@/services/step-up.service";

async function apply(cardId: unknown, input: z.infer<typeof CardUpdate>, okMessage: string): Promise<NonNullable<ActionState>> {
  const id = z.string().uuid().parse(cardId);
  const { user, role, supabase } = await authorize("cards/:id", "PATCH");
  await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
  const parsed = CardUpdate.parse(input);
  if ((await needsStepUp(supabase, user.id, role, id, parsed)) && !(await hasRecentStepUp(user.id))) return { ok: false, stepUp: true };
  await updateCard(supabase, user.id, role, id, parsed);
  revalidatePath("/cards");
  return { ok: true, message: okMessage };
}

export async function setCardStatusAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const status = z.enum(["active", "blocked"]).parse(form.get("status"));
    return apply(form.get("cardId"), { status }, status === "blocked" ? "Card blocked. New purchases will be declined." : "Card unblocked.");
  });
}

export async function setCardLimitAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const raw = form.get("limit")?.toString().trim();
    const cents = raw && /^0+(\.0{1,2})?$/.test(raw) ? 0 : parseAmountToCents(raw);
    if (cents === null || cents > MAX_DAILY_LIMIT_CENTS) {
      return { ok: false, message: "Choose a limit between $0 and $10,000.", fieldErrors: { limit: "Between $0 and $10,000." } };
    }
    return apply(form.get("cardId"), { dailyLimitCents: cents }, "Daily limit updated.");
  });
}
