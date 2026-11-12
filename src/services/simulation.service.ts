/**
 * Simulation engine (admin only, behind SIMULATION_ADMIN_ENABLED).
 *
 * - Scenario and action come from strict enums; `days` is a bounded loop counter (1..31).
 * - Execution happens in SECURITY DEFINER SQL functions callable only by the service role.
 * - Reset removes simulation-generated rows only; baseline demo data and the audit trail are kept.
 * - Events record the admin's opaque user id, never names or emails.
 * - Simulation amounts may use non-cryptographic randomness (SQL random()); identifiers never do.
 */
import "server-only";
import { z } from "zod";
import { HttpError } from "@/lib/errors";
import { adminClient } from "@/lib/supabase/admin";
import { SCENARIO_KEYS } from "@/services/scenarios";

export const SimAction = z.discriminatedUnion("action", [
  z.object({ action: z.literal("apply"), scenario: z.enum(SCENARIO_KEYS), days: z.number().int().min(1).max(31).default(1) }),
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
      const { data, error } = await admin.rpc("sim_apply", { p_scenario: action.scenario, p_days: action.days, p_actor: actorId });
      if (error) throw new HttpError(400);
      return { rows: data as number };
    }
    case "advance": {
      // Advancing the clock settles pending transfers and executes due scheduled payments.
      const [settled, scheduled] = await Promise.all([admin.rpc("settle_pending_transfers"), admin.rpc("execute_due_scheduled_payments")]);
      if (settled.error || scheduled.error) throw new HttpError(500);
      await admin.from("sim_events").insert({ actor_id: actorId, scenario: "clock", kind: "apply", details: { days: action.days } });
      return { settled: settled.data as number, scheduledExecuted: scheduled.data as number };
    }
    case "reset": {
      const { error } = await admin.rpc("sim_reset_demo_data", { p_actor: actorId });
      if (error) throw new HttpError(500);
      return { reset: true };
    }
  }
}
