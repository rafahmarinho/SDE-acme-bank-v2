/**
 * Issues the caller's current access token for the in-memory Realtime client.
 * POST + same-origin check so it cannot be fetched cross-site; never cached.
 */
import { assertSameOrigin } from "@/lib/csrf";
import { errorResponse, HttpError } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 5;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new HttpError(401);
    const { data: { session } } = await supabase.auth.getSession(); // token only; identity verified above
    if (!session) throw new HttpError(401);
    return Response.json({ accessToken: session.access_token }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    return errorResponse(err);
  }
}
