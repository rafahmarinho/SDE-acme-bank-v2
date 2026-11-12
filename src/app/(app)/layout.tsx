/**
 * Authenticated customer/staff shell: side menu on desktop, bottom navigation on mobile.
 * The navigation is built from the SERVER-resolved role and is cosmetic only; access is enforced
 * by middleware, by each server action / route handler (authorize()), and by PostgreSQL RLS.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { getAuthenticatedUser, type AppRole } from "@/lib/supabase/server";

const NAV: Array<{ href: string; label: string; roles: AppRole[] }> = [
  { href: "/overview", label: "Overview", roles: ["customer"] },
  { href: "/accounts", label: "Accounts", roles: ["customer"] },
  { href: "/transfers", label: "Transfers", roles: ["customer"] },
  { href: "/beneficiaries", label: "Beneficiaries", roles: ["customer"] },
  { href: "/scheduled-payments", label: "Scheduled", roles: ["customer"] },
  { href: "/cards", label: "Cards", roles: ["customer"] },
  { href: "/statements", label: "Statements", roles: ["customer"] },
  { href: "/support", label: "Support", roles: ["customer", "support", "admin"] },
  { href: "/staff", label: "Staff panel", roles: ["support", "admin"] },
  { href: "/simulation", label: "Simulation", roles: ["admin"] },
  { href: "/settings", label: "Settings", roles: ["customer", "support", "admin"] },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, role } = await getAuthenticatedUser();
  if (!user || !role) redirect("/login");
  const items = NAV.filter((n) => n.roles.includes(role));
  return (
    <div className="min-h-screen md:flex">
      <nav aria-label="Main" className="hidden md:block md:w-60">
        <ul>{items.map((n) => <li key={n.href}><Link href={n.href}>{n.label}</Link></li>)}</ul>
        <LogoutButton />
      </nav>
      <div className="flex-1 pb-16 md:pb-0">{children}</div>
      <nav aria-label="Bottom" className="fixed inset-x-0 bottom-0 flex justify-around md:hidden">
        {items.slice(0, 5).map((n) => <Link key={n.href} href={n.href}>{n.label}</Link>)}
      </nav>
    </div>
  );
}
