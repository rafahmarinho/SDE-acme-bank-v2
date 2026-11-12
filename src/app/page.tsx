/**
 * Entry point: signed-in users go to their role's home, everyone else to /login.
 */
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export default async function Page() {
  const { user, role } = await getAuthenticatedUser();
  if (!user) redirect("/login");
  redirect(role === "customer" ? "/overview" : "/staff");
}
