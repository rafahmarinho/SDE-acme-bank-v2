/**
 * Settlement job (Vercel Cron, see vercel.json): completes pending transfers and executes due
 * scheduled payments. Authenticated with CRON_SECRET (Bearer), compared in constant time.
 * Not reachable by end users: no session is accepted here.
 */
import { safeEqual } from "@/lib/crypto";
import { serverEnv } from "@/lib/env";
import { settlePendingTransfers } from "@/services/transfers.service";

export const maxDuration = 30;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const expected = `Bearer ${serverEnv().CRON_SECRET}`;
  const given = req.headers.get("authorization") ?? "";
  if (!safeEqual(given, expected)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    const result = await settlePendingTransfers();
    return Response.json({ ok: true, ...result });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
