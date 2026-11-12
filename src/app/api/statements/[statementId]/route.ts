/**
 * GET /api/statements/{statementId} -> 303 redirect to a 60-second signed URL.
 * Indirect object reference: the client supplies only an opaque UUID; the storage path is looked up
 * server-side with an ownership filter. File names/paths are never accepted from the client.
 */
import { authorize } from "@/lib/authz";
import { errorResponse, HttpError } from "@/lib/errors";
import { isUuid } from "@/lib/ids";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { signedStatementUrl } from "@/services/statements.service";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ statementId: string }> }) {
  try {
    const { statementId } = await params;
    if (!isUuid(statementId)) throw new HttpError(404);
    const { user, supabase } = await authorize("statements/:id", "GET");
    await rateLimit(`read:${user.id}`, BUDGETS.read);
    const url = await signedStatementUrl(supabase, user.id, statementId);
    return new Response(null, { status: 303, headers: { Location: url, "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
