"use server";
/**
 * Beneficiary actions. Adding a payee requires step-up authentication, because it enables
 * transfers to a new destination (T338). Owner derived from the session, never from the form (T378).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrorsOf, runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { BeneficiaryInput, createBeneficiary, deleteBeneficiary } from "@/services/beneficiaries.service";
import { hasRecentStepUp } from "@/services/step-up.service";

export async function addBeneficiaryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, supabase } = await authorize("beneficiaries", "POST");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const parsed = BeneficiaryInput.safeParse({
      nickname: form.get("nickname"), bank_name: form.get("bank_name"),
      account_number: String(form.get("account_number") ?? "").replace(/[\s-]/g, ""),
    });
    if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
    if (!(await hasRecentStepUp(user.id))) return { ok: false, stepUp: true };
    await createBeneficiary(supabase, user.id, parsed.data);
    revalidatePath("/beneficiaries");
    return { ok: true, message: `${parsed.data.nickname} was added to your beneficiaries.` };
  });
}

export async function deleteBeneficiaryAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, supabase } = await authorize("beneficiaries", "DELETE");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const id = z.string().uuid().parse(form.get("id"));
    await deleteBeneficiary(supabase, user.id, id);
    revalidatePath("/beneficiaries");
    return { ok: true, message: "Beneficiary removed." };
  });
}
