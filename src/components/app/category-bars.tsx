/**
 * Spending by category: single-series magnitude -> horizontal bar list in one hue (brand orange).
 * Labels and values are text (text tokens, not series color), so the list doubles as the table view;
 * each row has a hover/focus tooltip via title. No legend: the card title names the series.
 */
import { categoryLabel } from "@/components/app/common";
import { formatMoney } from "@/lib/money";

export function CategoryBars({ data, totalCents }: { data: Array<{ category: string; cents: number }>; totalCents: number }) {
  const max = Math.max(1, ...data.map((d) => d.cents));
  const rows = data.slice(0, 6);
  const other = data.slice(6).reduce((a, d) => a + d.cents, 0);
  if (other > 0) rows.push({ category: "other-rest", cents: other });
  return (
    <ul className="grid gap-3" aria-label="Spending by category">
      {rows.map((d) => {
        const label = d.category === "other-rest" ? "Everything else" : categoryLabel(d.category);
        const share = totalCents > 0 ? Math.round((d.cents / totalCents) * 100) : 0;
        return (
          <li key={d.category} title={`${label}: ${formatMoney(d.cents)} (${share}% of spending)`} className="grid gap-1.5">
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="text-foreground">{label}</span>
              <span className="tabular text-muted-foreground"><span className="font-medium text-foreground">{formatMoney(d.cents)}</span> · {share}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted">
              <div className="h-2 rounded-full bg-brand" style={{ width: `${Math.max(2, (d.cents / max) * 100)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
