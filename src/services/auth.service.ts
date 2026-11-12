/**
 * Authentication service (server-only): login with brute-force throttling, password recovery,
 * password change with session revocation, and role assignment that forces new sessions.
 *
 * Login/reset always go through this service, never straight from the browser to Supabase,
 * so throttling cannot be bypassed.
 */
import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/env.public";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { createServerClient, type AppRole } from "@/lib/supabase/server";

const GENERIC_LOGIN_FAILURE = { ok: false as const, message: "Invalid email or password." };
const GENERIC_RESET_RESPONSE = {
  ok: true as const,
  message: "If an account exists for that email, we sent password reset instructions.",
};

export const PasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter.")
  .regex(/[A-Z]/, "Add an uppercase letter.")
  .regex(/[0-9]/, "Add a digit.");

const LoginSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), password: z.string().min(1).max(128) });

/** Exponential backoff after 5 consecutive failures: 30s, 60s, 120s ... capped at 24h. */
function backoffSeconds(failures: number, threshold: number) {
  if (failures < threshold) return 0;
  return Math.min(30 * 2 ** (failures - threshold), 24 * 3600);
}

export async function login(raw: unknown, ip: string) {
  const parsed = LoginSchema.safeParse(raw);
  if (!parsed.success) return GENERIC_LOGIN_FAILURE;
  const { email, password } = parsed.data;
  const key = `login:${email}`;

  await rateLimit(`login-ip:${ip}`, BUDGETS.loginIp);
  await rateLimit(key, BUDGETS.login);

  const admin = adminClient();
  const { data: state } = await admin.rpc("login_failure_status", { p_key: key });
  const status = (state ?? { failures: 0, seconds_since_last: null }) as { failures: number; seconds_since_last: number | null; role_hint: string | null };
  // Staff accounts get a stricter threshold.
  const threshold = status.role_hint === "admin" || status.role_hint === "support" ? 3 : 5;
  const wait = backoffSeconds(status.failures, threshold);
  if (wait > 0 && status.seconds_since_last !== null && status.seconds_since_last < wait) {
    await admin.rpc("audit_event", { p_event: "login_throttled", p_details: { ip } });
    return GENERIC_LOGIN_FAILURE;
  }

  const supabase = await createServerClient();
  await supabase.auth.signOut({ scope: "local" }); // never carry a pre-existing session into a new login
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    await admin.rpc("login_failure_record", { p_key: key });
    await admin.rpc("audit_event", { p_event: "login_failed", p_details: { ip } });
    return GENERIC_LOGIN_FAILURE;
  }
  await admin.rpc("login_failure_reset", { p_key: key });
  return { ok: true as const };
}

const ResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  captchaToken: z.string().max(4096).optional(),
});

/** Same response whether or not the account exists; rate limited per email and per IP. */
export async function requestPasswordReset(raw: unknown, ip: string) {
  const parsed = ResetRequestSchema.safeParse(raw);
  if (!parsed.success) return GENERIC_RESET_RESPONSE;
  try {
    await rateLimit(`reset-ip:${ip}`, BUDGETS.passwordReset);
    await rateLimit(`reset:${parsed.data.email}`, BUDGETS.passwordReset);
  } catch {
    return GENERIC_RESET_RESPONSE; // do not reveal throttling either
  }
  const supabase = await createServerClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv.siteUrl}/auth/confirm?next=/reset-password`, // allow-listed in Supabase Auth URL config
    captchaToken: parsed.data.captchaToken,
  });
  return GENERIC_RESET_RESPONSE;
}

/** Completes a reset (or changes the password): enforces policy, revokes all other sessions. */
export async function setNewPassword(raw: unknown) {
  const parsed = z.object({ password: PasswordSchema }).safeParse(raw);
  if (!parsed.success) return { ok: false as const, message: parsed.error.issues[0]?.message ?? "Invalid password." };
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, message: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { ok: false as const, message: "Unable to update password." };
  await supabase.auth.signOut({ scope: "others" });
  await adminClient().rpc("audit_event", { p_event: "password_changed", p_details: { user_id: user.id } });
  const { sendSecurityNotice } = await import("@/services/email.service");
  if (user.email) await sendSecurityNotice(user.email, "password_changed");
  return { ok: true as const };
}

/** Admin-only (caller must have authorized "users:role"). New claims require new sessions. */
export async function setUserRole(targetUserId: string, role: AppRole, actorId: string) {
  const admin = adminClient();
  const { error } = await admin.auth.admin.updateUserById(targetUserId, { app_metadata: { role } });
  if (error) throw new Error("role update failed");
  await admin.rpc("revoke_user_sessions", { p_user_id: targetUserId });
  await admin.rpc("audit_event", { p_event: "role_changed", p_details: { target: targetUserId, role, actor: actorId } });
}
