/**
 * Browser Supabase client - used ONLY for Realtime subscriptions.
 *
 * - The session lives in httpOnly cookies managed by the server, so nothing about it is persisted in
 *   localStorage, sessionStorage or IndexedDB (persistSession: false, no storage adapter).
 * - Data reads and writes go through Server Components / Server Actions / route handlers, which
 *   re-fetch persisted data from PostgreSQL on reload. Query results are not cached in browser storage.
 * - For Realtime, the page fetches a short-lived access token from /api/auth/realtime-token and keeps
 *   it in memory only.
 */
"use client";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let browserClient: SupabaseClient | undefined;

export function getRealtimeClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  return browserClient;
}

/** Authorizes the Realtime socket with an in-memory token (RLS applies to postgres_changes). */
export async function connectRealtime(): Promise<SupabaseClient> {
  const client = getRealtimeClient();
  const res = await fetch("/api/auth/realtime-token", { method: "POST", credentials: "same-origin", cache: "no-store" });
  if (!res.ok) throw new Error("Not authenticated");
  const { accessToken } = (await res.json()) as { accessToken: string };
  client.realtime.setAuth(accessToken);
  return client;
}

/** Called on logout: closes every channel and drops the in-memory token. */
export async function disconnectRealtime() {
  if (!browserClient) return;
  await browserClient.removeAllChannels();
  browserClient.realtime.setAuth(null);
}
