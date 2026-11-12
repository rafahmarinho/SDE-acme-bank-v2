/**
 * Approved cryptography only, from the platform library (node:crypto):
 *   - Integrity / signed tokens: HMAC-SHA-256 with a 256-bit key (APP_SIGNING_KEY)
 *   - Field encryption: AES-256-GCM, 96-bit random IV, 128-bit auth tag (APP_ENCRYPTION_KEY)
 *   - Secret comparison: timingSafeEqual
 * Passwords are hashed by Supabase Auth (bcrypt) - never here.
 * Forbidden anywhere in this codebase: MD5, SHA-1, DES/3DES, RC4, ECB mode, Base64 "encryption"
 * (enforced by eslint no-restricted-imports / no-restricted-syntax).
 */
import "server-only";
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/lib/env";

const key = (b64: string) => Buffer.from(b64, "base64");

export function hmacSign(data: string): string {
  return createHmac("sha256", key(serverEnv().APP_SIGNING_KEY)).update(data, "utf8").digest("base64url");
}

export function hmacVerify(data: string, signature: string): boolean {
  const expected = Buffer.from(hmacSign(data));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function encryptField(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(serverEnv().APP_ENCRYPTION_KEY), iv);
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64url");
}

export function decryptField(payload: string): string {
  const buf = Buffer.from(payload, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ct = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key(serverEnv().APP_ENCRYPTION_KEY), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
