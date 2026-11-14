/**
 * Simulation engine (admin only, behind SIMULATION_ADMIN_ENABLED - T49).
 *
 * - Scenario and action come from strict enums; `days` is a bounded loop counter (1..31) (T42).
 * - Execution happens in SECURITY DEFINER SQL functions callable only by the service role (T19).
 * - Scenarios are rows in ONE database (scenario_id), never separate connections (T2599).
 * - Reset restores the demo baseline for demo customers only; the audit trail is kept (T349).
 * - Events record the admin's opaque user id and customer pseudonyms, never names or emails (T544, T744).
 * - Simulation amounts may use non-cryptographic randomness (SQL random()); identifiers never do (T151).
 */
import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { adminClient } from "@/lib/supabase/admin";
import { SCENARIO_KEYS } from "@/services/scenarios";

export const SimAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("apply"), scenario: z.enum(SCENARIO_KEYS), customerId: z.string().uuid().optional() }),
  z.object({ action: z.literal("advance"), days: z.number().int().min(1).max(31) }),
  z.object({ action: z.literal("reset") }),
]);
export type SimAction = z.infer<typeof SimAction>;

export function simulationEnabled() {
  return process.env.SIMULATION_ADMIN_ENABLED === "true";
}

export async function runSimulationAction(action: SimAction, actorId: string) {
  const admin = adminClient();
  switch (action.action) {
    case "apply": {
      if (action.customerId) {
        // Service-role path never trusts a client-chosen id blindly: it must be a demo customer (T378).
        const { data } = await admin.from("profiles").select("id").eq("id", action.customerId).eq("is_demo", true).maybeSingle();
        if (!data) throw new HttpError(404);
      }
      const { data, error } = await admin.rpc("sim_apply", { p_scenario: action.scenario, p_customer: action.customerId ?? null, p_actor: actorId });
      if (error) throw new HttpError(400);
      return data as { customers: number; rows: number; approved: number; declined: number };
    }
    case "advance": {
      const { data, error } = await admin.rpc("sim_advance", { p_days: action.days, p_actor: actorId });
      if (error) throw new HttpError(500);
      return data as { days: number; simDate: string; purchases: number; declined: number; payroll: number; scheduledExecuted: number; settled: number };
    }
    case "reset": {
      const { data: demo } = await admin.from("profiles").select("id").eq("is_demo", true).limit(50);
      const { error } = await admin.rpc("sim_reset_demo_data", { p_actor: actorId });
      if (error) throw new HttpError(500);
      // Remove generated statement files of demo customers (rows were deleted by the reset).
      for (const { id } of demo ?? []) {
        const { data: files } = await admin.storage.from("statements").list(id, { limit: 1000 });
        if (files && files.length > 0) await admin.storage.from("statements").remove(files.map((f) => `${id}/${f.name}`));
      }
      return { reset: true };
    }
  }
}

export type SimEvent = { id: number; at: string; scenario: string; kind: string; details: Record<string, unknown> };

/** Events are read with the admin's RLS-scoped client (sim_events_admin_select); only the demo
 *  customer picker needs the service role, because profiles RLS is owner-only. */
export async function simulationOverview(supabase: SupabaseClient) {
  const [events, today, demo] = await Promise.all([
    supabase.from("sim_events").select("id, at, scenario, kind, details").order("at", { ascending: false }).order("id", { ascending: false }).limit(50),
    supabase.rpc("app_today"),
    adminClient().from("profiles").select("id, full_name").eq("is_demo", true).order("email").limit(20),
  ]);
  if (events.error || demo.error) throw new HttpError(500);
  return { events: events.data as SimEvent[], simDate: (today.data as string) ?? null, demoCustomers: demo.data };
}
