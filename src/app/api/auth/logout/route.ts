/**
 * Logout: POST only (CSRF-checked), revokes the session, and tells the browser to drop cached
 * pages, cookies and storage for this origin. Clients close Realtime channels before submitting.
 */
import { NextResponse } from "next/server";
import { assertSameOrigin } from "@/lib/csrf";
import { publicEnv } from "@/lib/env.public";
import { errorResponse } from "@/lib/errors";
import { createServerClient } from "@/lib/supabase/server";

export const maxDuration = 5;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const supabase = await createServerClient();
    await supabase.auth.signOut({ scope: "local" });
    const res = NextResponse.redirect(new URL("/login", publicEnv.siteUrl), 303);
    res.headers.set("Clear-Site-Data", '"cache", "cookies", "storage"');
    res.headers.set("Cache-Control", "no-store");
    return res;
  } catch (err) {
    return errorResponse(err);
  }
}
