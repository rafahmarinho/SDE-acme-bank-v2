/**
 * Link for URLs that come from data (DB or user input). Only http(s)/mailto are rendered;
 * javascript:, data: and other schemes become "#". External links open without opener access.
 */
import { safeHref } from "@/lib/safe-url";

export function SafeLink({ href, children }: { href: string | null | undefined; children: React.ReactNode }) {
  const safe = safeHref(href);
  const external = safe.startsWith("http");
  return (
    <a href={safe} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
      {children}
    </a>
  );
}
