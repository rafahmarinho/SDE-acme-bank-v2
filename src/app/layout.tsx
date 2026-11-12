/**
 * Root layout: English UI, navy blue + orange theme (Tailwind tokens in globals.css).
 * The per-request CSP nonce set by middleware is applied by Next.js to its own scripts.
 */
import "./globals.css";

export const metadata = { title: "ACME Bank", description: "ACME Bank digital banking (simulation)" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
