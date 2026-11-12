"use client";
/**
 * Logout control shown in every authenticated layout (desktop side menu and mobile bottom nav).
 * Closes Realtime channels and drops the in-memory token before the POST to /api/auth/logout.
 */
import { disconnectRealtime } from "@/lib/supabase/client";

export function LogoutButton() {
  return (
    <form
      method="post"
      action="/api/auth/logout"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        await disconnectRealtime();
        form.submit();
      }}
    >
      <button type="submit">Sign out</button>
    </form>
  );
}
