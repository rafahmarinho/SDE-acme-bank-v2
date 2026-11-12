/**
 * CSRF defences for custom route handlers (Server Actions are Origin-checked by Next.js itself):
 *   1. Origin must exactly match the site origin.
 *   2. Double-submit token: the `csrf_token` cookie (set by middleware, SameSite=Strict) must equal
 *      the `x-csrf-token` header, compared in constant time.
 * Session cookies are SameSite=Lax, and no GET endpoint changes state.
 */
import "server-only";
import { timingSafeEqual } from "node:crypto";
import { publicEnv } from "@/lib/env.public";
import { HttpError } from "@/lib/errors";

export const CSRF_COOKIE = "csrf_token";
export const CSRF_HEADER = "x-csrf-token";

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  if (!origin || origin !== new URL(publicEnv.siteUrl).origin) throw new HttpError(403);
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function assertCsrf(req: Request) {
  assertSameOrigin(req);
  const cookieToken = readCookie(req, CSRF_COOKIE);
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) throw new HttpError(403);
  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw new HttpError(403);
}
