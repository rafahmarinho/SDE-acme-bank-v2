/**
 * CSV encoding with spreadsheet formula-injection protection (pure, unit-tested).
 * Cells starting with = + - @ TAB or CR are prefixed with a single quote so Excel/Sheets
 * treat them as text; every cell is quoted and embedded quotes are doubled.
 */
export function csvCell(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  const neutralised = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${neutralised.replace(/"/g, '""')}"`;
}

export function toCsv(header: string[], rows: unknown[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** Formats integer cents as a fixed two-decimal string (no floating-point accumulation). */
export function formatCents(cents: number | bigint): string {
  const n = BigInt(cents);
  const sign = n < 0n ? "-" : "";
  const abs = n < 0n ? -n : n;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}
