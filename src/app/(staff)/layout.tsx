/**
 * Staff area layout (Server Component). Re-checks the role on the server for every staff page,
 * independently of the middleware and of any client-side navigation hiding.
 * /simulation additionally requires the admin role (enforced in its own page and API).
 */
import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await getAuthenticatedUser();
  if (!user) redirect("/login");
  if (role !== "support" && role !== "admin") redirect("/overview");
  return <>{children}</>;
}
