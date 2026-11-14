/**
 * Authenticated shell for customer screens (and shared screens such as Support and Settings).
 * The navigation is built from the SERVER-resolved role and is cosmetic only; access is enforced
 * by the proxy, by each page (requirePageRole), by every server action / route handler
 * (authorize()) and by PostgreSQL RLS (T17, T338).
 */
import { AppShell } from "@/components/app/app-shell";
import { requirePageRole } from "@/lib/page-auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role, supabase } = await requirePageRole(["customer", "support", "admin"]);
  let displayName = (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "ACME user";
  if (role === "customer") {
    const { data } = await supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle();
    if (data?.full_name) displayName = data.full_name;
  }
  return <AppShell role={role} displayName={displayName} email={user.email ?? ""}>{children}</AppShell>;
}
