import { cn } from "@/lib/utils";

/** ACME Bank wordmark (inline SVG, no external assets). */
export function Brand({ className, tone = "light" }: { className?: string; tone?: "light" | "dark" }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <svg viewBox="0 0 32 32" aria-hidden className="size-8 shrink-0">
        <rect width="32" height="32" rx="9" className="fill-brand" />
        <path d="M9 23 16 8l7 15h-3.6L16 15.4 12.6 23Z" fill="white" />
        <rect x="11.5" y="19" width="9" height="2.4" rx="1.2" className="fill-navy-900" />
      </svg>
      <span className={cn("text-lg", tone === "light" ? "text-white" : "text-primary")}>
        ACME <span className="text-brand">Bank</span>
      </span>
    </span>
  );
}
