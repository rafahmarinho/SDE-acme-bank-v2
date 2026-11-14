"use client";
/**
 * Subscribes to Supabase Realtime postgres_changes for the given tables and refreshes the Server
 * Components when something changes, so balances and statuses update live. RLS applies to the
 * stream (the socket is authorized with the user's token, kept in memory only - T1468). Channels
 * are closed on unmount and on logout (T1539).
 */
import { Radio } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { connectRealtime } from "@/lib/supabase/client";

type Table =
  | "ledger_entries" | "transfers" | "cards" | "card_authorizations" | "scheduled_payments"
  | "support_tickets" | "support_replies" | "sim_events";

export function RealtimeRefresher({ tables, channel }: { tables: Table[]; channel: string }) {
  const router = useRouter();
  const [live, setLive] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const key = tables.join(",");

  useEffect(() => {
    let cancelled = false;
    let cleanup: (() => void) | undefined;
    connectRealtime()
      .then((client) => {
        if (cancelled) return;
        const ch = client.channel(`${channel}-${crypto.randomUUID()}`);
        for (const table of key.split(",")) {
          ch.on("postgres_changes", { event: "*", schema: "public", table }, () => {
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => router.refresh(), 400); // debounce bursts (simulation)
          });
        }
        ch.subscribe((status) => setLive(status === "SUBSCRIBED"));
        cleanup = () => void client.removeChannel(ch);
      })
      .catch(() => setLive(false));
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
      cleanup?.();
    };
  }, [key, channel, router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" title={live ? "Live updates on" : "Connecting to live updates"}>
      <Radio aria-hidden className={live ? "size-3.5 text-success" : "size-3.5"} />
      {live ? "Live" : "Offline"}
    </span>
  );
}
