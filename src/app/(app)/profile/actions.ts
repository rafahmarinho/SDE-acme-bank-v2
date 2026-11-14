"use server";
/**
 * Profile self-service: customers keep their own personal data accurate (T742).
 * public.profiles is the single source of truth (other tables reference it by id), every field is
 * validated server-side, only the columns granted in 0003_security.sql are updatable (email and role
 * are not), and changes are audited (audit_profiles trigger, with phone/address values excluded).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fieldErrorsOf, runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { HttpError } from "@/lib/errors";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";

const ProfileUpdate = z.object({
  full_name: z.string().trim().min(2, "Enter your full name.").max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number."),
  address_line1: z.string().trim().min(1, "Enter your street address.").max(200),
  city: z.string().trim().min(1, "Enter your city.").max(100),
  postal_code: z.string().trim().min(1, "Enter your postal code.").max(20),
});

export async function updateProfileAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    const { user, supabase } = await authorize("profile", "PATCH");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const parsed = ProfileUpdate.safeParse(Object.fromEntries(form));
    if (!parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors: fieldErrorsOf(parsed.error.issues) };
    const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
    if (error) throw new HttpError(500);
    revalidatePath("/profile");
    revalidatePath("/", "layout");
    return { ok: true, message: "Your profile was updated." };
  });
}
