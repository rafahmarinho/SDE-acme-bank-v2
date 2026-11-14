"use server";
import { revalidatePath } from "next/cache";
import { fieldErrorsOf, runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { OpenAccountRequest, openAdditionalAccount } from "@/services/accounts.service";

/** Opens an extra checking/savings account (max 4; customer derived from auth.uid() in SQL). */
export async function openAccountAction(_prev: ActionState<{ id: string }>, form: FormData): Promise<ActionState<{ id: string }>> {
  return runAction(async () => {
    const { user, supabase } = await authorize("accounts", "POST");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const parsed = OpenAccountRequest.safeParse({ kind: form.get("kind"), name: form.get("name") });
    if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
    const id = await openAdditionalAccount(supabase, parsed.data);
    revalidatePath("/accounts");
    revalidatePath("/overview");
    return { ok: true, message: "Your new account is open.", data: { id } };
  });
}
