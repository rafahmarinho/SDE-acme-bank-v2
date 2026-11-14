/**
 * Login page (email + password via auth.service; throttled, generic errors - T70).
 * The `next` parameter is passed through as plain form data and validated by safeNext() server-side (T37).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/feedback";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string; opened?: string }> }) {
  const { next, reset, opened } = await searchParams;
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight text-primary">Welcome back</h1>
      <p className="mt-1 text-sm text-muted-foreground">Sign in to your ACME Bank account.</p>
      {reset || opened ? (
        <Alert variant="success" className="mt-6">
          <CircleCheck aria-hidden />
          <AlertDescription>{reset ? "Your password was updated. Please sign in." : "Thanks! If your details were valid, your account is ready. Sign in to get started."}</AlertDescription>
        </Alert>
      ) : null}
      <LoginForm next={typeof next === "string" ? next : ""} />
      <p className="mt-8 text-center text-sm text-muted-foreground">
        New to ACME Bank?{" "}
        <Link href="/open-account" className="font-medium text-brand hover:underline">Open an account</Link>
      </p>
    </div>
  );
}
