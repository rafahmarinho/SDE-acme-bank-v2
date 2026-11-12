/**
 * Request helpers for route handlers: size-limited, schema-validated JSON bodies and client IP.
 */
import "server-only";
import type { z } from "zod";
import { HttpError } from "@/lib/errors";

export const DEFAULT_MAX_BODY_BYTES = 16_384;

/** Reads a JSON body, rejecting oversized payloads (413) before parsing, then validates it. */
export async function readJson<T>(req: Request, schema: z.ZodType<T>, maxBytes = DEFAULT_MAX_BODY_BYTES): Promise<T> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new HttpError(413);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Content-Type must be application/json.");

  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) throw new HttpError(413);

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400);
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400);
  return parsed.data;
}

/** Best-effort client IP (Vercel sets x-forwarded-for / x-real-ip). Used only for rate limiting. */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
