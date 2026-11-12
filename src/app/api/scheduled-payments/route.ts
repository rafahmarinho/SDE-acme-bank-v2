/**
 * Scheduled payments API.
 *   GET   -> caller's scheduled payments (max 50)
 *   POST  -> schedule a payment from the caller's account to the caller's beneficiary (RLS-checked)
 *   PATCH -> cancel one of the caller's scheduled payments (the only allowed update)
 */
import { z } from "zod";
import { authorize } from "@/lib/authz";
import { assertCsrf } from "@/lib/csrf";
import { errorResponse, HttpError } from "@/lib/errors";
import { readJson } from "@/lib/http";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

const Create = z.object({
  fromAccountId: z.string().uuid(),
  beneficiaryId: z.string().uuid(),
  amountCents: z.number().int().positive().max(100_000_000),
  executeOn: z.string().date(),
  reference: z.string().trim().max(140).optional(),
});
const Cancel = z.object({ id: z.string().uuid() });

export async function GET() {
  try {
    const { user, supabase } = await authorize("scheduled-payments", "GET");
    await rateLimit(`read:${user.id}`, BUDGETS.read);
    const { data, error } = await supabase
      .from("scheduled_payments")
      .select("id, beneficiary_id, amount_cents, reference, execute_on, status")
      .eq("customer_id", user.id)
      .order("execute_on")
      .limit(50);
    if (error) throw new HttpError(500);
    return Response.json({ scheduledPayments: data });
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
    if (new Date(input.executeOn) <= new Date()) throw new HttpError(400, "Choose a future date.");
    const { data, error } = await supabase
      .from("scheduled_payments")
      .insert({
        customer_id: user.id,
        from_account_id: input.fromAccountId,
        beneficiary_id: input.beneficiaryId,
        amount_cents: input.amountCents,
        execute_on: input.executeOn,
        reference: input.reference ?? null,
      })
      .select("id, execute_on, status")
      .single();
    if (error) throw new HttpError(404); // RLS rejects foreign accounts/beneficiaries
    return Response.json(data, { status: 201 });
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
    const { data } = await supabase
      .from("scheduled_payments")
      .update({ status: "cancelled" })
      .eq("id", id)
      .eq("customer_id", user.id)
      .eq("status", "scheduled")
      .select("id, status")
      .maybeSingle();
    if (!data) throw new HttpError(404);
    return Response.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
