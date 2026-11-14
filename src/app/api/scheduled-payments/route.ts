/**
 * Scheduled payments API (same service layer as the UI).
 *   GET   -> caller's upcoming scheduled payments (max 50)
 *   POST  -> schedule a payment from the caller's account to the caller's beneficiary (RLS-checked)
 *   PATCH -> cancel one of the caller's scheduled payments (the only allowed update)
 */
import { z } from "zod";
import { authorize } from "@/lib/authz";
import { assertCsrf } from "@/lib/csrf";
import { errorResponse } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { cancelScheduled, createScheduled, listScheduled, ScheduleInput } from "@/services/scheduled.service";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

const Create = ScheduleInput.extend({ frequency: z.enum(["once", "monthly"]).default("once") });
const Cancel = z.object({ id: z.string().uuid() });

export async function GET() {
  try {
    const { user, supabase } = await authorize("scheduled-payments", "GET");
    await rateLimit(`read:${user.id}`, BUDGETS.read);
    return Response.json({ scheduledPayments: await listScheduled(supabase, user.id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    assertCsrf(req);
    const { user, supabase } = await authorize("scheduled-payments", "POST");
    await rateLimit(`money:${user.id}`, BUDGETS.moneyMovement);
    const input = await readJson(req, Create, 2048);
    return Response.json(await createScheduled(supabase, user.id, input), { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(req: Request) {
  try {
    assertCsrf(req);
    const { user, supabase } = await authorize("scheduled-payments", "PATCH");
    await rateLimit(`mutation:${user.id}`, BUDGETS.mutation);
    const { id } = await readJson(req, Cancel, 512);
    return Response.json(await cancelScheduled(supabase, user.id, id));
  } catch (err) {
    return errorResponse(err);
  }
}
