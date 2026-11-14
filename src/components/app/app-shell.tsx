/**
 * Authenticated shell: side menu on desktop, bottom navigation on mobile.
 * Server Component - the navigation is built from the role resolved on the server (getUser()).
 */
import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";
import type { AppRole } from "@/lib/supabase/server";
import { Brand } from "./brand";
import { navFor, ROLE_LABEL } from "./nav-config";
import { BottomNav, SidebarLinks } from "./nav-links";

type Props = { role: AppRole; displayName: string; email: string; children: React.ReactNode };

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("") || "?";
}

export function AppShell({ role, displayName, email, children }: Props) {
  const nav = navFor(role, process.env.SIMULATION_ADMIN_ENABLED === "true");
  const home = role === "customer" ? "/overview" : "/staff";
  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="px-5 pt-6 pb-8">
          <Link href={home} aria-label="ACME Bank home"><Brand /></Link>
        </div>
        <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
          <SidebarLinks items={nav.main} />
          <p className="mt-8 mb-2 px-3 text-xs font-medium tracking-wider text-sidebar-foreground/50 uppercase">Account</p>
          <SidebarLinks items={nav.account} />
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{initials(displayName)}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-white">{displayName}</p>
              <p className="truncate text-xs text-sidebar-foreground/60">{role === "customer" ? email : ROLE_LABEL[role]}</p>
            </div>
          </div>
          <LogoutButton className="text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white" />
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between bg-sidebar px-4 py-3 md:hidden">
          <Link href={home} aria-label="ACME Bank home"><Brand className="[&_svg]:size-7" /></Link>
          <LogoutButton compact className="w-auto px-2 text-sidebar-foreground hover:bg-sidebar-accent" />
        </header>
        <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 md:pb-12 lg:px-8">{children}</main>
      </div>

      <BottomNav items={nav.main} more={nav.account} />
    </div>
  );
}
