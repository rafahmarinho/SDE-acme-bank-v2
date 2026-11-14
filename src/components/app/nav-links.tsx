"use client";
/** Active-state aware navigation lists for the desktop sidebar and the mobile bottom bar. */
import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { NavItem } from "./nav-config";
import { NavIcon } from "./nav-icon";

const isActive = (pathname: string, href: string) =>
  pathname === href || (href !== "/staff" && pathname.startsWith(`${href}/`)) || (href === "/staff" && pathname.startsWith("/staff/customers"));

export function SidebarLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <ul className="grid gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white",
                active && "bg-sidebar-accent text-white shadow-[inset_3px_0_0_var(--brand)]",
              )}
            >
              <NavIcon name={item.icon} className="size-4.5" />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function BottomNav({ items, more }: { items: NavItem[]; more: NavItem[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const primary = items.filter((i) => i.mobile).slice(0, 4);
  const rest = [...items.filter((i) => !primary.includes(i)), ...more];
  const moreActive = rest.some((i) => isActive(pathname, i.href));
  return (
    <>
      <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-5">
          {primary.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn("flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground", active && "text-primary")}
                >
                  <NavIcon name={item.icon} className={cn("size-5", active && "text-brand")} />
                  <span className="max-w-full truncate px-1">{item.label.split(" ")[0]}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className={cn("flex w-full cursor-pointer flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground", moreActive && "text-primary")}
            >
              <MoreHorizontal aria-hidden className={cn("size-5", moreActive && "text-brand")} />
              More
            </button>
          </li>
        </ul>
      </nav>
      <Dialog open={open} onOpenChange={setOpen} title="Menu" className="mb-0 max-w-full rounded-b-none sm:mb-auto sm:max-w-md sm:rounded-xl">
        <ul className="grid gap-1">
          {rest.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted", isActive(pathname, item.href) && "bg-muted text-primary")}
              >
                <NavIcon name={item.icon} className="size-4.5 text-muted-foreground" />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
