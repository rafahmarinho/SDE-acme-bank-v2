/**
 * Step-up authentication (T338): sensitive operations - adding a beneficiary (and so paying a new
 * payee), raising a card limit, unblocking a card, changing a password, changing a user's role -
 * require the user to have re-entered their password within the last 10 minutes.
 *
 * - The password is verified against Supabase Auth with a throw-away, non-persisting client; the
 *   verification session is revoked immediately. Passwords are never stored or logged.
 * - Proof of re-authentication is an httpOnly, SameSite=Strict cookie carrying
 *   `<userId>.<expiry>.<HMAC-SHA-256>` (APP_SIGNING_KEY), bound to the user and expiring after 10 minutes.
 * - Attempts are rate limited per user and audited.
 */
import "server-only";
import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { hmacSign, safeEqual } from "@/lib/crypto";
import { publicEnv } from "@/lib/env.public";
import { rateLimit } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";

const COOKIE = "acme_stepup";
const TTL_SECONDS = 600;

const payload = (userId: string, exp: number) => `stepup:${userId}:${exp}`;

export async function hasRecentStepUp(userId: string): Promise<boolean> {
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const [uid, expRaw, sig] = value.split(".");
  const exp = Number(expRaw);
  if (!uid || !sig || uid !== userId || !Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(hmacSign(payload(uid, exp)), sig);
}

export async function verifyStepUp(user: User, password: string): Promise<boolean> {
  await rateLimit(`stepup:${user.id}`, { max: 5, windowSec: 900 });
  const admin = adminClient();
  if (!user.email || password.length < 1 || password.length > 128) return false;

  const verifier = createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await verifier.auth.signInWithPassword({ email: user.email, password });
  if (error || data.user?.id !== user.id) {
    await admin.rpc("audit_event", { p_event: "stepup_failed", p_details: { user_id: user.id } });
    return false;
  }
  await verifier.auth.signOut({ scope: "local" }); // discard the verification session

  const exp = Math.floor(Date.now() / 1000) + TTL_SECONDS;
  (await cookies()).set(COOKIE, `${user.id}.${exp}.${hmacSign(payload(user.id, exp))}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: TTL_SECONDS,
  });
  await admin.rpc("audit_event", { p_event: "stepup_ok", p_details: { user_id: user.id } });
  return true;
}

export async function clearStepUp() {
  (await cookies()).delete(COOKIE);
}
