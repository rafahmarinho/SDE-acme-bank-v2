/**
 * Reset-password page, reached via /auth/confirm (single-use, expiring recovery token - T2).
 * Enforces the password policy server-side and revokes other sessions after the change.
 */
import type { Metadata } from "next";
import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Choose a new password" };

export default function Page() {
  return <ResetForm />;
}
