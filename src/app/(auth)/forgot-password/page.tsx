/**
 * Forgot-password page. Always shows the same confirmation (no account enumeration);
 * requests are rate limited per email and IP, and CAPTCHA-protected when Supabase Auth CAPTCHA is enabled (T2).
 */
import type { Metadata } from "next";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default async function Page({ searchParams }: { searchParams: Promise<{ expired?: string }> }) {
  const { expired } = await searchParams;
  return <ForgotForm expired={Boolean(expired)} />;
}
