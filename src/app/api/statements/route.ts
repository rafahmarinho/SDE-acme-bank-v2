/**
 * POST /api/statements -> generate a CSV/PDF statement for one of the caller's accounts.
 * Expensive operation: strict rate limit; period capped at 12 months / 10k rows.
 */
import { authorize } from "@/lib/authz";
import { assertCsrf } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { generateStatement, StatementRequest } from "@/services/statements.service";

export const maxDuration = 15;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const { user, supabase } = await authorize("statements", "POST");
    await rateLimit(`statement:${user.id}`, BUDGETS.statementGeneration);
    const input = await readJson(req, StatementRequest, 1024);
    return Response.json(await generateStatement(supabase, user.id, input), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
