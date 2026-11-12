/**
 * Next.js configuration for ACME Bank.
 *
 * - Static security headers on every response (anti-framing, HSTS, nosniff, referrer, permissions).
 *   The nonce-based Content-Security-Policy is set per request in src/middleware.ts.
 * - Server Action body-size limit and an explicit Origin allow-list (CSRF defence).
 * - No framework fingerprinting, no browser source maps, console output stripped in production.
 */
import type { NextConfig } from "next";

const siteHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").host;
  } catch {
    return "localhost:3000";
  }
})();

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false,
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100kb",
      allowedOrigins: [siteHost],
    },
  },
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        // Authenticated pages and APIs must never be cached by the browser or shared caches.
        source: "/(overview|accounts|transfers|beneficiaries|scheduled-payments|cards|statements|support|profile|settings|staff|simulation|api)(.*)",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
};

export default nextConfig;
