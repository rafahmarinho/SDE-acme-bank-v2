"use server";
/**
 * Simulation actions (admin only, 404 unless SIMULATION_ADMIN_ENABLED=true - T49). Inputs are
 * enum/bounded (T42) and every action is audited with the admin's id (T2602).
 */
import { revalidatePath } from "next/cache";
import { runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { HttpError } from "@/lib/errors";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { adminClient } from "@/lib/supabase/admin";
import { runSimulationAction, SimAction, simulationEnabled } from "@/services/simulation.service";

export async function simulationAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return runAction(async () => {
    if (!simulationEnabled()) throw new HttpError(404);
    const { user } = await authorize("simulation", "POST");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const kind = form.get("action");
    const action = SimAction.parse(
      kind === "apply" ? { action: "apply", scenario: form.get("scenario"), customerId: form.get("customerId") || undefined }
        : kind === "advance" ? { action: "advance", days: Number(form.get("days")) }
          : { action: kind },
    );
    await adminClient().rpc("audit_event", { p_event: `simulation_${action.action}`, p_details: { actor: user.id, action } });
    const result = await runSimulationAction(action, user.id);
    revalidatePath("/", "layout");
    let message = "Done.";
    if (action.action === "apply" && "rows" in result) message = `Scenario applied: ${result.rows} events for ${result.customers} customer(s) (${result.approved} approved, ${result.declined} declined).`;
    if (action.action === "advance" && "simDate" in result) message = `Clock advanced ${result.days} day(s) to ${result.simDate}: ${result.purchases} purchases (${result.declined} declined), ${result.scheduledExecuted} scheduled payments, ${result.settled} transfers settled.`;
    if (action.action === "reset") message = "Demo data reset to the baseline. The audit trail was kept.";
    return { ok: true, message };
  });
}
