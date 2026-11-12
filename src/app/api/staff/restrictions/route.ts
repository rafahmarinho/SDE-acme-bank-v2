/**
 * POST /api/staff/restrictions - support/admin record a customer's objection to a processing activity
 * (requested through the Support page). Audited via the audit_restrictions trigger.
 */
import { authorize } from "@/lib/authz";
import { assertCsrf } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { recordRestriction, RestrictionRequest } from "@/services/privacy.service";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const { user, supabase } = await authorize("staff/restrictions", "POST");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const input = await readJson(req, RestrictionRequest, 512);
    await recordRestriction(supabase, user.id, input);
    return Response.json({ ok: true }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
