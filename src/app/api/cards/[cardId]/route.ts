/**
 * Card API: GET card details, PATCH block/unblock or change the daily limit.
 * Object-level authorization: only the owner (or admin for PATCH, support/admin for GET) - see cards.service + RLS.
 */
import { authorize } from "@/lib/authz";
import { assertCsrf } from "@/lib/csrf";
import { errorResponse, HttpError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { isUuid } from "@/lib/ids";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { CardUpdate, getCard, updateCard } from "@/services/cards.service";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ cardId: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { cardId } = await params;
    if (!isUuid(cardId)) throw new HttpError(404);
    const { user, role, supabase } = await authorize("cards/:id", "GET");
    await rateLimit(`read:${user.id}`, BUDGETS.read);
    return Response.json(await getCard(supabase, user.id, role, cardId));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    assertCsrf(req);
    const { cardId } = await params;
    if (!isUuid(cardId)) throw new HttpError(404);
    const { user, role, supabase } = await authorize("cards/:id", "PATCH");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const input = await readJson(req, CardUpdate, 1024);
    return Response.json(await updateCard(supabase, user.id, role, cardId, input));
  } catch (err) {
    return errorResponse(err);
  }
}
