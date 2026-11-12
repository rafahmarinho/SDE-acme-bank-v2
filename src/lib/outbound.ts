/**
 * The only sanctioned way to make server-side outbound HTTP requests.
 *
 * ACME Bank's external integrations (card network, payment rails, KYC) are SIMULATED in-process
 * (src/services/scenarios.ts + SQL); they make no network calls. Anything that must call out
 * uses safeFetch(): https only, exact host allow-list, no redirects, timeout, response size cap.
 * User-supplied URLs are never fetched.
 */
import "server-only";
import { publicEnv } from "@/lib/env.public";

const ALLOWED_HOSTS = new Set<string>([new URL(publicEnv.supabaseUrl).host]);
const MAX_RESPONSE_BYTES = 1_000_000;

export async function safeFetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
  const target = new URL(url);
  if (target.protocol !== "https:") throw new Error("outbound: scheme not allowed");
  if (!ALLOWED_HOSTS.has(target.host)) throw new Error("outbound: host not allowed");
  if (target.username || target.password) throw new Error("outbound: credentials in URL not allowed");

  const res = await fetch(target, { ...init, redirect: "error", signal: AbortSignal.timeout(5_000) });
  const length = Number(res.headers.get("content-length") ?? "0");
  if (length > MAX_RESPONSE_BYTES) throw new Error("outbound: response too large");
  return res;
}
