"use server";
/**
 * Scheduled payment actions. "review" returns the fee from public.fee_for() so it is shown before
 * confirmation; "confirm" re-validates everything and inserts (RLS re-checks ownership + future date).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { parseAmountToCents } from "@/lib/money";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { cancelScheduled, createScheduled, feeFor, ScheduleInput } from "@/services/scheduled.service";

export type ScheduleReview = { feeCents: number; amountCents: number };

export async function scheduleAction(_prev: ActionState<ScheduleReview>, form: FormData): Promise<ActionState<ScheduleReview>> {
  return runAction(async () => {
    const { user, supabase } = await authorize("scheduled-payments", "POST");
    await rateLimit(`money:${user.id}`, BUDGETS.moneyMovement);
    const amountCents = parseAmountToCents(form.get("amount")?.toString());
    const parsed = ScheduleInput.safeParse({
      fromAccountId: form.get("fromAccountId"), beneficiaryId: form.get("beneficiaryId"), amountCents: amountCents ?? 0,
      executeOn: form.get("executeOn"), frequency: form.get("frequency"), reference: form.get("reference") || undefined,
    });
    if (!amountCents || !parsed.success) {
      const fieldErrors: Record<string, string> = {};
      if (!amountCents) fieldErrors.amount = "Enter an amount, for example 120.00.";
      if (!parsed.success) for (const i of parsed.error.issues) {
        const k = String(i.path[0]);
        if (k === "executeOn") fieldErrors.executeOn = "Choose a date.";
        if (k === "beneficiaryId") fieldErrors.beneficiaryId = "Choose a beneficiary.";
      }
      return { ok: false, message: "Please check the highlighted fields.", fieldErrors };
    }
    const feeCents = await feeFor(supabase, amountCents, true);
    if (form.get("intent") !== "confirm") return { ok: true, data: { feeCents, amountCents } };
    await createScheduled(supabase, user.id, parsed.data);
    revalidatePath("/scheduled-payments");
    revalidatePath("/overview");
    return { ok: true, message: "Payment scheduled.", data: { feeCents, amountCents } };
  });
}

export async function cancelScheduledAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, supabase } = await authorize("scheduled-payments", "PATCH");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    await cancelScheduled(supabase, user.id, z.string().uuid().parse(form.get("id")));
    revalidatePath("/scheduled-payments");
    return { ok: true, message: "Scheduled payment cancelled." };
  });
}
