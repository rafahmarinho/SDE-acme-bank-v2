/**
 * Server-side Supabase client bound to the request's auth cookies.
 *
 * - Session cookies are httpOnly + Secure + SameSite=Lax: page scripts can never read the tokens.
 * - Auth decisions always use `auth.getUser()`, which validates the JWT with the Auth server.
 *   `getSession()` is never trusted on the server.
 * - This client uses the anon key + the user's JWT, so PostgreSQL RLS applies to every query.
 */
import "server-only";
import { createServerClient as createSsrClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env.public";

export const SESSION_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
};

export async function createServerClient() {
  const store = await cookies();
  return createSsrClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS }));
        } catch {
          // Called from a Server Component (read-only cookies); middleware refreshes the session instead.
        }
      },
    },
  });
}

export type AppRole = "customer" | "support" | "admin";

/** Role comes from app_metadata, which only the service role can write (never user_metadata). */
export function roleOf(user: User | null): AppRole | null {
  if (!user) return null;
  const role = user.app_metadata?.role;
  return role === "support" || role === "admin" ? role : "customer";
}

/** Returns the validated user (or null) together with the RLS-scoped client. */
export async function getAuthenticatedUser() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user, role: roleOf(user) };
}
