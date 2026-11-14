"use server";
/**
 * Transfer actions: quote (fee shown before confirmation) and confirm.
 *  - Amounts are parsed from text into integer cents without floating point.
 *  - The quote is single-use, expires in 5 minutes and is bound to the user by an HMAC signature;
 *    confirmation re-checks ownership and balance under a row lock in SQL (T29, T378, T60).
 *  - Money-movement budget: 10 requests/minute per user plus a per-IP budget (T1362).
 */
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { runAction, type ActionState } from "@/lib/action";
import { authorize } from "@/lib/authz";
import { parseAmountToCents } from "@/lib/money";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { listAccounts } from "@/services/accounts.service";
import { confirm, quote } from "@/services/transfers.service";

export type Quote = {
  quoteId: string; signature: string; feeCents: number; totalCents: number; amountCents: number; expiresAt: string;
  availableCents: number; reference: string;
};

const QuoteForm = z.object({
  fromAccountId: z.string().uuid(),
  destination: z.string().regex(/^(own|ben):[0-9a-f-]{36}$/),
  reference: z.string().trim().max(140).optional(),
});

async function ip() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function quoteTransferAction(_prev: ActionState<Quote>, form: FormData): Promise<ActionState<Quote>> {
  return runAction(async () => {
    const { user, supabase } = await authorize("transfers", "POST");
    await rateLimit(`ip:${await ip()}`, BUDGETS.ip);
    await rateLimit(`money:${user.id}`, BUDGETS.moneyMovement);
    const amountCents = parseAmountToCents(form.get("amount")?.toString());
    const parsed = QuoteForm.safeParse({ fromAccountId: form.get("fromAccountId"), destination: form.get("destination"), reference: form.get("reference") || undefined });
    const fieldErrors: Record<string, string> = {};
    if (!amountCents) fieldErrors.amount = "Enter an amount, for example 25.00.";
    if (!parsed.success) fieldErrors.destination = "Choose where the money goes.";
    if (!amountCents || !parsed.success) return { ok: false, message: "Please check the highlighted fields.", fieldErrors };

    const [kind, id] = parsed.data.destination.split(":") as ["own" | "ben", string];
    if (kind === "own" && id === parsed.data.fromAccountId) return { ok: false, fieldErrors: { destination: "Choose a different account." }, message: "Please check the highlighted fields." };
    const q = await quote(supabase, user.id, {
      fromAccountId: parsed.data.fromAccountId, amountCents,
      ...(kind === "own" ? { toAccountId: id } : { beneficiaryId: id }),
    });
    const from = (await listAccounts(supabase, user.id)).find((a) => a.id === parsed.data.fromAccountId);
    return { ok: true, data: { ...q, amountCents, availableCents: from?.balance_cents ?? 0, reference: parsed.data.reference ?? "" } };
  });
}

const ConfirmForm = z.object({ quoteId: z.string().uuid(), signature: z.string().min(20).max(100), reference: z.string().trim().max(140).optional() });

export async function confirmTransferAction(_prev: ActionState<{ transferId: string }>, form: FormData): Promise<ActionState<{ transferId: string }>> {
  return runAction(async () => {
    const { user, supabase } = await authorize("transfers", "POST");
    await rateLimit(`ip:${await ip()}`, BUDGETS.ip);
    await rateLimit(`money:${user.id}`, BUDGETS.moneyMovement);
    const input = ConfirmForm.parse({ quoteId: form.get("quoteId"), signature: form.get("signature"), reference: form.get("reference") || undefined });
    const result = await confirm(supabase, user.id, input);
    revalidatePath("/transfers");
    revalidatePath("/overview");
    revalidatePath("/accounts");
    return { ok: true, message: "Transfer submitted. It's pending until it settles.", data: { transferId: result.transferId } };
  });
}
