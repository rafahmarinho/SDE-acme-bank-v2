/** Ledger rows grouped by day (Server Component). Descriptions render as React text (T36). */
import {
  ArrowDownLeft, ArrowUpRight, Banknote, Bus, Coffee, HeartPulse, Home, Lightbulb, Popcorn, Receipt, ShoppingBag, ShoppingCart,
} from "lucide-react";
import { categoryLabel, Money } from "@/components/app/common";
import { Badge } from "@/components/ui/badge";
import { dayKey, formatLongDate } from "@/lib/format";
import type { LedgerRow } from "@/services/accounts.service";

const ICON = {
  groceries: ShoppingCart, dining: Coffee, transport: Bus, shopping: ShoppingBag, utilities: Lightbulb, entertainment: Popcorn,
  health: HeartPulse, salary: Banknote, deposit: ArrowDownLeft, transfer: ArrowUpRight, fee: Receipt, rent: Home, other: Receipt,
} as const;

export function LedgerList({ rows, accountNames }: { rows: LedgerRow[]; accountNames?: Map<string, string> }) {
  const groups = new Map<string, LedgerRow[]>();
  for (const r of rows) {
    const k = dayKey(r.booked_at);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return (
    <div className="grid gap-5">
      {[...groups.entries()].map(([day, items]) => (
        <section key={day} aria-label={formatLongDate(day)}>
          <h3 className="mb-1 px-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{formatLongDate(day)}</h3>
          <ul className="divide-y rounded-lg border bg-card">
            {items.map((r) => {
              const Icon = ICON[r.category as keyof typeof ICON] ?? Receipt;
              const pending = r.transfer?.status === "pending";
              return (
                <li key={r.id} className="flex items-center gap-3 px-3 py-3">
                  <span className={r.direction === "credit" ? "grid size-9 shrink-0 place-items-center rounded-full bg-success/12 text-[oklch(0.5_0.13_155)]" : "grid size-9 shrink-0 place-items-center rounded-full bg-secondary text-primary"}>
                    <Icon aria-hidden className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{r.description}</p>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{categoryLabel(r.category)}</span>
                      {accountNames?.get(r.account_id) ? <span>· {accountNames.get(r.account_id)}</span> : null}
                      {r.card_id ? <span>· Card</span> : null}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Money cents={Number(r.amount_cents)} direction={r.direction} className="text-sm font-semibold" />
                    {pending ? <Badge variant="warning">Pending</Badge> : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
