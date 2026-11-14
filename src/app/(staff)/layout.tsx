/**
 * Staff area layout (Server Component). Re-checks the role on the server for every staff page,
 * independently of the proxy and of any client-side navigation hiding (T17).
 * Admin-only pages (/staff/audit, /simulation) check the admin role again themselves.
 */
import { AppShell } from "@/components/app/app-shell";
import { requirePageRole } from "@/lib/page-auth";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await requirePageRole(["support", "admin"]);
  const displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "Staff";
  return <AppShell role={role} displayName={displayName} email={user.email ?? ""}>{children}</AppShell>;
}
