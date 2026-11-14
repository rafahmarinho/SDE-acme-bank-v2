/**
 * Money helpers. Amounts are integer cents everywhere (DB bigint, API numbers, UI state); floating
 * point is never used for arithmetic. Pure functions, safe on server and client, unit-tested.
 */
import { formatCents } from "@/lib/csv";

const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });

/** "1,234.56" style user input -> integer cents, or null when invalid / not positive. Max 9,999,999.99. */
export function parseAmountToCents(raw: string | null | undefined): number | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().replace(/[$,\s]/g, "");
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return cents > 0 ? cents : null;
}

/** Integer cents -> "$1,234.56" (exact: formats the decimal string, not cents / 100). */
export function formatMoney(cents: number | bigint, opts: { signed?: boolean } = {}): string {
  const n = BigInt(cents);
  const abs = n < 0n ? -n : n;
  const text = USD.format(formatCents(abs) as Intl.StringNumericLiteral);
  if (n < 0n) return `-${text}`;
  return opts.signed && n > 0n ? `+${text}` : text;
}

/** Signed cents for a ledger row. */
export const signedAmount = (amountCents: number, direction: "debit" | "credit") => (direction === "debit" ? -amountCents : amountCents);

/** Masks an account number for display: "•••• 4821". */
export const maskAccount = (accountNumber: string) => `•••• ${accountNumber.slice(-4)}`;
