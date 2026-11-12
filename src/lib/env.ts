/**
 * Server-only, validated environment configuration.
 *
 * Secrets (service-role key, signing/encryption keys, cron secret) are read ONLY here,
 * never hardcoded and never exposed with a NEXT_PUBLIC_ prefix. Importing this module from a
 * client component fails the build because of `server-only`.
 */
import "server-only";
import { z } from "zod";
import { publicEnv } from "@/lib/env.public";

const base64Key32 = z
  .string()
  .refine((v) => Buffer.from(v, "base64").length === 32, "must be 32 bytes, base64-encoded");

const ServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),
  APP_SIGNING_KEY: base64Key32,
  APP_ENCRYPTION_KEY: base64Key32,
  CRON_SECRET: z.string().min(32),
  SIMULATION_ADMIN_ENABLED: z.enum(["true", "false"]).default("false"),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema> & typeof publicEnv;

let cached: ServerEnv | undefined;

/** Lazily validates server env so `next build` without secrets still succeeds; fails fast at first use. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const parsed = ServerEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
      throw new Error(`Invalid server environment configuration: ${fields}`);
    }
    cached = { ...parsed.data, ...publicEnv };
  }
  return cached;
}
