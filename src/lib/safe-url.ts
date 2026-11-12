/**
 * URL safety helpers (pure, usable on server and client).
 */

/** Post-login / post-reset redirect target: only same-origin relative paths are allowed. */
export function safeNext(next: string | null | undefined, fallback = "/overview"): string {
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  try {
    const parsed = new URL(next, "https://placeholder.invalid");
    if (parsed.origin !== "https://placeholder.invalid") return fallback;
    return parsed.pathname + parsed.search;
  } catch {
    return fallback;
  }
}

/** href values from data (DB / user input): only http(s) and mailto, everything else neutralized. */
export function safeHref(value: string | null | undefined): string {
  if (!value) return "#";
  try {
    const url = new URL(value);
    return ["https:", "http:", "mailto:"].includes(url.protocol) ? url.href : "#";
  } catch {
    return "#";
  }
}
