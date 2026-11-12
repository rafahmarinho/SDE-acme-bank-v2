"use server";
/**
 * Auth server actions. Server Actions are public HTTP endpoints: each validates input,
 * is Origin-checked by Next.js (serverActions.allowedOrigins), and delegates to auth.service,
 * which applies throttling and generic responses.
 */
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-url";
import { login, requestPasswordReset, setNewPassword } from "@/services/auth.service";

export type FormState = { ok: boolean; message?: string } | null;

async function requestIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "unknown";
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const result = await login({ email: form.get("email"), password: form.get("password") }, await requestIp());
  if (!result.ok) return result;
  redirect(safeNext(form.get("next")?.toString()));
}

export async function forgotPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  return requestPasswordReset(
    { email: form.get("email"), captchaToken: form.get("cf-turnstile-response")?.toString() || undefined },
    await requestIp(),
  );
}

export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  if (form.get("password") !== form.get("confirm")) return { ok: false, message: "Passwords do not match." };
  const result = await setNewPassword({ password: form.get("password") });
  if (!result.ok) return result;
  redirect("/login?reset=1");
}
