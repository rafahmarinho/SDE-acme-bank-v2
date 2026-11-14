/**
 * Server Component guard for pages: validates the session with getUser() and the role on the
 * server (T17). Wrong-role visitors are sent to their own home instead of seeing an error.
 * Data access below this point still goes through the RLS-scoped client.
 */
import "server-only";
import { redirect } from "next/navigation";
import { getAuthenticatedUser, type AppRole } from "@/lib/supabase/server";

export const homeFor = (role: AppRole) => (role === "customer" ? "/overview" : "/staff");

export async function requirePageRole(allowed: readonly AppRole[]) {
  const { user, role, supabase } = await getAuthenticatedUser();
  if (!user || !role) redirect("/login");
  if (!allowed.includes(role)) redirect(homeFor(role));
  return { user, role, supabase };
}
