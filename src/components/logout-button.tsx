"use client";
/**
 * Logout control shown in every authenticated layout (desktop side menu and mobile header).
 * Closes Realtime channels and drops the in-memory token, then POSTs to /api/auth/logout, which
 * revokes the session and answers with Clear-Site-Data (T1539). POST + same-origin check (T29).
 */
import { LogOut } from "lucide-react";
import { disconnectRealtime } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function LogoutButton({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <form
      method="post"
      action="/api/auth/logout"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        await disconnectRealtime().catch(() => undefined);
        form.submit();
      }}
    >
      <button
        type="submit"
        className={cn("flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors", className)}
        aria-label="Sign out"
      >
        <LogOut aria-hidden className="size-4.5" />
        {compact ? null : "Sign out"}
      </button>
    </form>
  );
}
