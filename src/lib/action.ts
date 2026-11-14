/**
 * Server Action plumbing. Server Actions are public HTTP endpoints, so every action:
 *   - re-authorizes on its own (authorize() inside the callback; T17 / T184),
 *   - validates input with zod (bounded strings, enums; T536 / T42),
 *   - converts failures into a generic, user-friendly state (no SQL errors or stack traces; T2139).
 * Next.js checks the Origin header of every Server Action against serverActions.allowedOrigins (T29).
 */
import "server-only";
import { unstable_rethrow } from "next/navigation";
import { HttpError } from "@/lib/errors";

export type ActionState<T = undefined> = {
  ok: boolean;
  message?: string;
  /** The action needs a fresh password confirmation (step-up authentication, T338). */
  stepUp?: boolean;
  fieldErrors?: Record<string, string>;
  data?: T;
} | null;

export async function runAction<T>(fn: () => Promise<NonNullable<ActionState<T>>>): Promise<ActionState<T>> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err); // let redirect()/notFound() through
    if (err instanceof HttpError) return { ok: false, message: err.publicMessage };
    if (err && typeof err === "object" && "issues" in err) return { ok: false, message: "Please check the highlighted fields." };
    console.error("server action failed", err instanceof Error ? err.message : err);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Maps zod issues to { field: message } for inline form errors. */
export function fieldErrorsOf(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "form");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}
