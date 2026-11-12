/**
 * Staff customer lookup (support/admin). Returns only a schema-validated summary with a masked phone,
 * never raw profile rows. Requires >= 3 characters and returns at most 20 results (enforced in SQL).
 * Database errors are logged server-side and mapped to a generic message.
 */
import { z } from "zod";
import { authorize } from "@/lib/authz";
import { errorResponse, HttpError } from "@/lib/errors";
import { BUDGETS, rateLimit } from "@/lib/rate-limit";

export const maxDuration = 10;
export const dynamic = "force-dynamic";

const Query = z.object({ q: z.string().trim().min(3).max(100) });
const CustomerSummary = z.object({
  id: z.string().uuid(),
  full_name: z.string(),
  email: z.string(),
  phone_masked: z.string().nullable(),
  account_count: z.coerce.number(),
});

export async function GET(req: Request) {
  try {
    const { user, supabase } = await authorize("staff/customers", "GET");
    await rateLimit(`read:${user.id}`, BUDGETS.read);
    const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return Response.json({ customers: [] });
    const { data, error } = await supabase.rpc("staff_search_customers", { p_query: parsed.data.q });
    if (error) {
      console.error("staff lookup failed", error.code);
      throw new HttpError(500, "Search failed.");
    }
    return Response.json({ customers: z.array(CustomerSummary).max(20).parse(data) });
  } catch (err) {
    return errorResponse(err);
  }
}
