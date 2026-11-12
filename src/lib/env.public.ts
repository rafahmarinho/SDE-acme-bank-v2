/**
 * Public (browser-safe) configuration. Values are referenced literally so Next.js can inline them.
 *
 * The Supabase URL is fixed configuration validated once at startup: it is never built from
 * request data, and in production it must be an https://*.supabase.co endpoint.
 */
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

const SupabaseUrl = z
  .string()
  .url()
  .refine((value) => {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash) return false; // no injected parameters
    if (!isProd) return url.protocol === "https:" || url.hostname === "localhost" || url.hostname === "127.0.0.1";
    return url.protocol === "https:" && url.hostname.endsWith(".supabase.co");
  }, "NEXT_PUBLIC_SUPABASE_URL must be an https Supabase project URL without credentials or query parameters");

const SiteUrl = z
  .string()
  .url()
  .refine((value) => !isProd || new URL(value).protocol === "https:", "NEXT_PUBLIC_SITE_URL must use https in production");

const PublicEnvSchema = z.object({
  supabaseUrl: SupabaseUrl,
  supabaseAnonKey: z.string().min(20),
  siteUrl: SiteUrl,
});

function loadPublicEnv() {
  const parsed = PublicEnvSchema.safeParse({
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  });
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
    throw new Error(`Invalid public environment configuration: ${fields}`);
  }
  return Object.freeze(parsed.data);
}

export const publicEnv = loadPublicEnv();

/** Realtime endpoint derived from the validated URL (https -> wss), never from user input. */
export const supabaseRealtimeOrigin = `wss://${new URL(publicEnv.supabaseUrl).host}`;
