/**
 * Server-side authorization for route handlers and server actions. Deny by default.
 *
 * Every API entry point calls `authorize(resource, method)` before doing any work. The returned
 * Supabase client is the user-scoped one, so PostgreSQL RLS re-checks object ownership.
 */
import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { HttpError } from "@/lib/errors";
import { getAuthenticatedUser, type AppRole } from "@/lib/supabase/server";

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

export const POLICY = {
  "accounts": { GET: ["customer"] },
  "transfers": { GET: ["customer"], POST: ["customer"] },
  "scheduled-payments": { GET: ["customer"], POST: ["customer"], PATCH: ["customer"] },
  "beneficiaries": { GET: ["customer"], POST: ["customer"], DELETE: ["customer"] },
  "cards/:id": { GET: ["customer", "support", "admin"], PATCH: ["customer", "admin"] },
  "statements": { POST: ["customer"] },
  "statements/:id": { GET: ["customer"] },
  "profile": { GET: ["customer"], PATCH: ["customer"] },
  "consents": { GET: ["customer"], PATCH: ["customer"] },
  "support": { GET: ["customer", "support", "admin"], POST: ["customer", "support", "admin"] },
  "staff/customers": { GET: ["support", "admin"] },
  "staff/restrictions": { POST: ["support", "admin"] },
  "users:role": { PATCH: ["admin"] },
  "simulation": { GET: ["admin"], POST: ["admin"] },
} as const satisfies Record<string, Partial<Record<Method, readonly AppRole[]>>>;

export type Resource = keyof typeof POLICY;

export type AuthContext = { user: User; role: AppRole; supabase: SupabaseClient };

export async function authorize(resource: Resource, method: Method): Promise<AuthContext> {
  const { user, role, supabase } = await getAuthenticatedUser();
  if (!user || !role) throw new HttpError(401);
  const allowed = (POLICY[resource] as Partial<Record<Method, readonly AppRole[]>>)[method];
  if (!allowed || !allowed.includes(role)) throw new HttpError(403);
  return { user, role, supabase };
}
