/**
 * Transfers API.
 *   GET  -> list the caller's transfers (paginated, own rows only)
 *   POST -> { action: "quote", ... } returns the fee before confirmation
 *           { action: "confirm", quoteId, signature, reference } executes it (pending until settlement)
 * Every request: authorize() (role), rate limit, CSRF (mutations), size-limited schema-validated body.
 */
import { z } from "zod";
import { authorize } from "@/lib/authz";
import { assertCsrf } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { clientIp, readJson } from "@/lib/http";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { confirm, ConfirmRequest, listTransfers, quote, QuoteRequest } from "@/services/transfers.service";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("quote"), quote: QuoteRequest }),
  z.object({ action: z.literal("confirm"), confirm: ConfirmRequest }),
]);

export async function GET(req: Request) {
  try {
    const { user, supabase } = await authorize("transfers", "GET");
    await rateLimit(`read:${user.id}`, BUDGETS.read);
    const limit = Number(new URL(req.url).searchParams.get("limit") ?? "25");
    return Response.json({ transfers: await listTransfers(supabase, user.id, Number.isFinite(limit) ? limit : 25) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const { user, supabase } = await authorize("transfers", "POST");
    await rateLimit(`ip:${clientIp(req)}`, BUDGETS.ip);
    await rateLimit(`money:${user.id}`, BUDGETS.moneyMovement);
    const body = await readJson(req, Body, 4096);
    if (body.action === "quote") return Response.json(await quote(supabase, user.id, body.quote));
    return Response.json(await confirm(supabase, user.id, body.confirm), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
