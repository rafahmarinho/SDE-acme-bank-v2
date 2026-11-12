/**
 * Exchanges the one-time recovery/confirmation token from the email link for a session
 * (server-side PKCE / OTP verification), then redirects to a validated same-origin path.
 */
import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/safe-url";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 5;

const ALLOWED_TYPES: EmailOtpType[] = ["recovery", "email", "email_change"];

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(url.searchParams.get("next"));

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash }); // single-use, expiring
    if (!error) return NextResponse.redirect(new URL(next, url.origin), 303);
  }
  return NextResponse.redirect(new URL("/forgot-password?expired=1", url.origin), 303);
}
