/**
 * Identifier and token generation - CSPRNG only (node:crypto). Math.random is never used for
 * identifiers or tokens (it is acceptable only for simulation amounts/jitter, which live in SQL).
 * Database primary keys are gen_random_uuid(); account numbers and card last4 come from
 * private.random_digits() (pgcrypto, rejection sampling).
 */
import "server-only";
import { randomBytes, randomUUID } from "node:crypto";

export const newId = (): string => randomUUID();

/** 256-bit URL-safe token (confirmation codes, nonces). */
export const newToken = (bytes = 32): string => randomBytes(bytes).toString("base64url");

/** Validates a client-supplied UUID before it is used in any query. */
export const isUuid = (value: unknown): value is string =>
  typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
