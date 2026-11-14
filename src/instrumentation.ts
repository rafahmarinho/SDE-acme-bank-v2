/**
 * Startup guards (Next.js instrumentation hook, runs once per server instance).
 *
 * - TLS certificate validation must never be disabled globally.
 * - Production must talk to Supabase over https/wss only (validated in env.public.ts).
 */
export function register() {
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") {
    throw new Error("Refusing to start: NODE_TLS_REJECT_UNAUTHORIZED=0 disables TLS certificate validation.");
  }
  if (process.env.NODE_ENV === "production") {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const loopback = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url); // local `next start` only
    if (!url.startsWith("https://") && !loopback) {
      throw new Error("Refusing to start: NEXT_PUBLIC_SUPABASE_URL must use https in production.");
    }
  }
}
