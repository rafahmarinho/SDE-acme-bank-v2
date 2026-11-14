/**
 * Navigation per role. This is UX only: what a role can reach is enforced by the proxy, the
 * Server Component layouts, authorize() in every action/route and PostgreSQL RLS (T17).
 */
import type { AppRole } from "@/lib/supabase/server";

export type NavIcon =
  | "home" | "wallet" | "send" | "users" | "calendar" | "card" | "file" | "help" | "shield"
  | "flask" | "settings" | "user" | "inbox" | "scroll";

export type NavItem = { href: string; label: string; icon: NavIcon; mobile?: boolean };

const CUSTOMER: NavItem[] = [
  { href: "/overview", label: "Overview", icon: "home", mobile: true },
  { href: "/accounts", label: "Accounts", icon: "wallet", mobile: true },
  { href: "/transfers", label: "Transfers", icon: "send", mobile: true },
  { href: "/beneficiaries", label: "Beneficiaries", icon: "users" },
  { href: "/scheduled-payments", label: "Scheduled payments", icon: "calendar" },
  { href: "/cards", label: "Cards", icon: "card", mobile: true },
  { href: "/statements", label: "Statements", icon: "file" },
  { href: "/support", label: "Support", icon: "help" },
];

const SUPPORT: NavItem[] = [
  { href: "/staff", label: "Staff dashboard", icon: "shield", mobile: true },
  { href: "/support", label: "Support tickets", icon: "inbox", mobile: true },
];

const ADMIN: NavItem[] = [
  ...SUPPORT,
  { href: "/staff/audit", label: "Audit log", icon: "scroll", mobile: true },
  { href: "/simulation", label: "Simulation", icon: "flask", mobile: true },
];

const ACCOUNT_CUSTOMER: NavItem[] = [
  { href: "/profile", label: "Profile", icon: "user" },
  { href: "/settings", label: "Settings", icon: "settings" },
];
const ACCOUNT_STAFF: NavItem[] = [{ href: "/settings", label: "Settings", icon: "settings" }];

export function navFor(role: AppRole, simulationEnabled: boolean) {
  const main = role === "customer" ? CUSTOMER : role === "admin" ? ADMIN.filter((i) => simulationEnabled || i.href !== "/simulation") : SUPPORT;
  return { main, account: role === "customer" ? ACCOUNT_CUSTOMER : ACCOUNT_STAFF };
}

export const ROLE_LABEL: Record<AppRole, string> = { customer: "Customer", support: "Support agent", admin: "Administrator" };
