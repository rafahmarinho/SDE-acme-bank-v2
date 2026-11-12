/**
 * Simulation API (admin only). Returns 404 when SIMULATION_ADMIN_ENABLED is not "true",
 * 403 for non-admins. Every action is validated against an allow-list, rate limited and audited.
 *   GET  -> recent simulation events
 *   POST -> { action: "apply", scenario, days } | { action: "advance", days } | { action: "reset" }
 */
import { authorize } from "@/lib/authz";
import { assertCsrf } from "@/lib/csrf";
import { errorResponse, HttpError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { runSimulationAction, SimAction, simulationEnabled } from "@/services/simulation.service";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    if (!simulationEnabled()) throw new HttpError(404);
    const { user, supabase } = await authorize("simulation", "GET");
    await rateLimit(`read:${user.id}`, BUDGETS.read);
    const { data, error } = await supabase
      .from("sim_events").select("id, at, scenario, kind, details").order("at", { ascending: false }).limit(50);
    if (error) throw new HttpError(500);
    return Response.json({ events: data });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    if (!simulationEnabled()) throw new HttpError(404);
    assertCsrf(req);
    const { user } = await authorize("simulation", "POST");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const action = await readJson(req, SimAction, 1024);
    await adminClient().rpc("audit_event", { p_event: `simulation_${action.action}`, p_details: { actor: user.id, action } });
    return Response.json(await runSimulationAction(action, user.id));
  } catch (err) {
    return errorResponse(err);
  }
}
