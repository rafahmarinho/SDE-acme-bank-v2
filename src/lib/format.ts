/**
 * Date formatting for the UI (en-US, UTC so server and client render identical text).
 */
const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const DATE_SHORT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "UTC",
});
const WEEKDAY = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const toDate = (v: string | Date) => (typeof v === "string" ? new Date(v.length === 10 ? `${v}T00:00:00Z` : v) : v);

export const formatDate = (v: string | Date) => DATE.format(toDate(v));
export const formatDateShort = (v: string | Date) => DATE_SHORT.format(toDate(v));
export const formatDateTime = (v: string | Date) => `${DATE_TIME.format(toDate(v))} UTC`;
export const formatLongDate = (v: string | Date) => WEEKDAY.format(toDate(v));

/** Day key (YYYY-MM-DD, UTC) used to group ledger rows. */
export const dayKey = (v: string) => v.slice(0, 10);

export function titleCase(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
