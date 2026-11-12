/**
 * Accounts API: GET ?accountId=...&text=...&direction=...&limit=...&cursor=...
 * Without accountId: the caller's accounts with balances. With accountId: paginated ledger search.
 */
import { authorize } from "@/lib/authz";
import { errorResponse } from "@/lib/errors";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";
import { listAccounts, searchLedger } from "@/services/accounts.service";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { user, supabase } = await authorize("accounts", "GET");
    await rateLimit(`read:${user.id}`, BUDGETS.read);
    const params = Object.fromEntries(new URL(req.url).searchParams);
    if (!params.accountId) return Response.json({ accounts: await listAccounts(supabase, user.id) });
    return Response.json(await searchLedger(supabase, user.id, params));
  } catch (err) {
    return errorResponse(err);
  }
}
