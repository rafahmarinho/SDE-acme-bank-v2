/**
 * Service-role Supabase client. BYPASSES RLS.
 *
 * Allowed callers only (each behind its own authorization check):
 *   - src/services/simulation.service.ts   (admin-only simulation actions)
 *   - src/services/transfers.service.ts    (settlement job, CRON_SECRET-authenticated)
 *   - src/lib/rate-limit.ts                (rate-limit counters)
 *   - src/services/statements.service.ts   (writing generated statements to private storage)
 *   - src/services/privacy.service.ts      (processing-restriction lookups)
 *   - src/services/auth.service.ts         (failed-login counters, session revocation)
 *   - src/app/(auth)/open-account/actions.ts (create the Auth user + open_customer_account())
 *   - src/app/api/simulation/route.ts      (audit_event for admin simulation actions)
 *   - src/services/email.service.ts        (consent / restriction check before optional emails)
 * Never use it for user-initiated reads: those go through createServerClient() so RLS applies.
 */
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

let client: SupabaseClient | undefined;

export function adminClient(): SupabaseClient {
  if (!client) {
    const env = serverEnv();
    client = createClient(env.supabaseUrl, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
