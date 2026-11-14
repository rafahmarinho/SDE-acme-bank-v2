/**
 * Entry point: signed-in users go to their role's home, everyone else to /login.
 */
import { redirect } from "next/navigation";
import { homeFor } from "@/lib/page-auth";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export default async function Page() {
  const { user, role } = await getAuthenticatedUser();
  if (!user || !role) redirect("/login");
  redirect(homeFor(role));
}
