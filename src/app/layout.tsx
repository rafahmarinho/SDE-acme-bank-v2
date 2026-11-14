/**
 * Root layout: English UI, navy blue + orange theme (tokens in globals.css).
 * Reading the request headers makes every page dynamic, so Next.js can stamp the per-request CSP
 * nonce (set by src/proxy.ts) on its scripts. Authenticated content is never statically cached.
 */
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "ACME Bank", template: "%s · ACME Bank" },
  description: "ACME Bank digital banking (simulation - no real money is moved).",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#13254a", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // opt into dynamic rendering (CSP nonce per request)
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
