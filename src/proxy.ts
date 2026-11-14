/**
 * Next.js Proxy (formerly Middleware) - runs before every page and API request.
 *
 *  1. Refreshes the Supabase session (httpOnly cookies) and validates the user with getUser() (T20).
 *  2. Route protection: unauthenticated users are sent to /login; role-restricted areas return 403
 *     (T338). Navigation hiding in the UI is cosmetic only - this is one enforcement layer; pages,
 *     server actions, route handlers and PostgreSQL RLS each check again (T17, T184, T378).
 *  3. Nonce-based Content-Security-Policy with frame-ancestors 'none' (anti-clickjacking, T66, T37).
 *  4. CORS for /api: exact-origin allow-list only; unknown origins get no CORS headers (T257).
 *  5. Issues the double-submit CSRF cookie used by custom route handlers (T29).
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type Role = "customer" | "support" | "admin";

const PUBLIC_PATHS = [
  "/login", "/forgot-password", "/reset-password", "/open-account", "/legal/", "/auth/confirm",
  "/api/auth/logout", "/api/jobs/",
];
/** Signed-in users are sent home from these entry pages. */
const GUEST_ONLY = ["/login", "/open-account"];
/** First match wins, so more specific prefixes come first. */
const ROLE_RULES: Array<[prefix: string, roles: Role[]]> = [
  ["/staff/audit", ["admin"]],
  ["/staff", ["support", "admin"]],
  ["/simulation", ["admin"]],
  ["/api/staff", ["support", "admin"]],
  ["/api/simulation", ["admin"]],
];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SITE_ORIGIN = new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").origin;
const ALLOWED_ORIGINS = new Set([SITE_ORIGIN]);
const isDev = process.env.NODE_ENV !== "production";

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => (p.endsWith("/") ? pathname.startsWith(p) : pathname === p || pathname.startsWith(`${p}/`)));
}

function buildCsp(nonce: string) {
  const supabase = new URL(SUPABASE_URL);
  const realtime = `${supabase.protocol === "https:" ? "wss" : "ws"}://${supabase.host}`;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    // Next.js dev tooling injects <style> tags without a nonce; production keeps style elements nonce-only.
    isDev ? "style-src 'self' 'unsafe-inline'" : `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'", // style="" attributes (progress bars, Radix positioning); no CSS from user data
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self' ${supabase.origin} ${realtime}`,
    "frame-src https://challenges.cloudflare.com",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(!isDev && SITE_ORIGIN.startsWith("https:") ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

function applyCors(req: NextRequest, res: NextResponse) {
  const origin = req.headers.get("origin");
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE");
    res.headers.set("Access-Control-Allow-Headers", "content-type, x-csrf-token");
    res.headers.set("Access-Control-Max-Age", "600");
  }
  res.headers.append("Vary", "Origin");
  return res;
}

function randomToken(bytes = 32) {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

const roleOf = (meta: Record<string, unknown> | undefined): Role =>
  meta?.role === "admin" || meta?.role === "support" ? meta.role : "customer";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApi = pathname.startsWith("/api/");

  // CORS preflight: answer without touching the session.
  if (isApi && req.method === "OPTIONS") {
    return applyCors(req, new NextResponse(null, { status: 204 }));
  }

  const nonce = randomToken(16);
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);

  let res = NextResponse.next({ request: { headers: requestHeaders } });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: { headers: requestHeaders } });
        list.forEach(({ name, value, options }) =>
          res.cookies.set(name, value, { ...options, httpOnly: true, secure: !isDev, sameSite: "lax", path: "/" }),
        );
      },
    },
  });

  // Validates the JWT with Supabase Auth (never trust getSession() alone) and refreshes cookies.
  const { data: { user } } = await supabase.auth.getUser();
  const role: Role | null = user ? roleOf(user.app_metadata) : null;

  const finalize = (r: NextResponse) => {
    r.headers.set("Content-Security-Policy", csp);
    if (!req.cookies.get("csrf_token")) {
      r.cookies.set("csrf_token", randomToken(), { httpOnly: false, secure: !isDev, sameSite: "strict", path: "/" });
    }
    // Carry refreshed session cookies over to redirects/denials.
    if (r !== res) res.cookies.getAll().forEach((c) => r.cookies.set(c));
    return isApi ? applyCors(req, r) : r;
  };

  if (!user && !isPublic(pathname)) {
    if (isApi) return finalize(NextResponse.json({ error: "Authentication required." }, { status: 401 }));
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return finalize(NextResponse.redirect(login));
  }

  if (user && GUEST_ONLY.includes(pathname)) {
    return finalize(NextResponse.redirect(new URL("/", req.url)));
  }

  const rule = ROLE_RULES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  if (rule && (!role || !rule[1].includes(role))) {
    if (isApi) return finalize(NextResponse.json({ error: "Forbidden." }, { status: 403 }));
    return finalize(NextResponse.rewrite(new URL("/forbidden", req.url), { status: 403, request: { headers: requestHeaders } }));
  }

  return finalize(res);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
