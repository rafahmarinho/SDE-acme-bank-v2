"use server";
/**
 * Profile self-service: customers keep their own personal data accurate.
 * public.profiles is the single source of truth (other tables reference it by id), every field is
 * validated server-side, only the columns granted in 0003_security.sql are updatable, and changes
 * are audited (audit_profiles trigger, with phone/address values excluded from the audit payload).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { authorize } from "@/lib/authz";
import { HttpError } from "@/lib/errors";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";

const ProfileUpdate = z.object({
  full_name: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/).optional().or(z.literal("").transform(() => undefined)),
  address_line1: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  postal_code: z.string().trim().max(20).optional(),
});

export type ProfileState = { ok: boolean; message?: string } | null;

export async function updateProfileAction(_prev: ProfileState, form: FormData): Promise<ProfileState> {
  const { user, supabase } = await authorize("profile", "PATCH");
  await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
  const parsed = ProfileUpdate.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, message: "Please check the highlighted fields." };
  const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user.id);
  if (error) throw new HttpError(500);
  revalidatePath("/profile");
  return { ok: true, message: "Profile updated." };
}
