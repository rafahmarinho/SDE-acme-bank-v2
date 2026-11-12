/**
 * Login page (email + password via auth.service; throttled, generic errors).
 * The `next` parameter is passed through as plain form data and validated by safeNext() server-side.
 */
import { LoginForm } from "./login-form";

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string; reset?: string }> }) {
  const { next, reset } = await searchParams;
  return (
    <main className="mx-auto max-w-sm p-6">
      <h1 className="text-2xl font-semibold">Sign in to ACME Bank</h1>
      {reset ? <p role="status">Your password was updated. Please sign in.</p> : null}
      <LoginForm next={typeof next === "string" ? next : ""} />
    </main>
  );
}
