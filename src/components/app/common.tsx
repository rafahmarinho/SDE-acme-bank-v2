/** Presentational building blocks shared by every screen (Server Component safe). */
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-primary sm:text-3xl">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

/** Integer cents rendered as currency. Credits are green with a +, debits plain with a -. */
export function Money({
  cents, direction, className, signed = false,
}: { cents: number; direction?: "debit" | "credit"; className?: string; signed?: boolean }) {
  const value = direction === "debit" ? -cents : cents;
  return (
    <span className={cn("tabular whitespace-nowrap", direction === "credit" && "text-[oklch(0.5_0.13_155)]", className)}>
      {formatMoney(value, { signed: signed || direction === "credit" })}
    </span>
  );
}

const STATUS: Record<string, { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "brand" | "outline" }> = {
  completed: { label: "Completed", variant: "success" },
  pending: { label: "Pending", variant: "warning" },
  failed: { label: "Failed", variant: "destructive" },
  cancelled: { label: "Cancelled", variant: "secondary" },
  scheduled: { label: "Scheduled", variant: "brand" },
  executed: { label: "Executed", variant: "success" },
  active: { label: "Active", variant: "success" },
  blocked: { label: "Blocked", variant: "destructive" },
  frozen: { label: "Frozen", variant: "warning" },
  closed: { label: "Closed", variant: "secondary" },
  open: { label: "Open", variant: "warning" },
  answered: { label: "Answered", variant: "success" },
  approved: { label: "Approved", variant: "success" },
  declined: { label: "Declined", variant: "destructive" },
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = STATUS[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={s.variant} className={className}>{s.label}</Badge>;
}

export function EmptyState({ icon: Icon, title, description, action }: { icon: LucideIcon; title: string; description?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed bg-card/60 px-6 py-12 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-accent text-accent-foreground"><Icon aria-hidden className="size-6" /></span>
      <div>
        <p className="font-medium">{title}</p>
        {description ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatTile({ label, value, hint, icon: Icon, tone = "default" }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; icon?: LucideIcon; tone?: "default" | "brand" | "navy";
}) {
  return (
    <div className={cn(
      "rounded-xl border p-5 shadow-xs",
      tone === "navy" ? "border-navy-800 bg-navy-900 text-white" : tone === "brand" ? "border-brand/30 bg-accent" : "bg-card",
    )}>
      <div className="flex items-center justify-between gap-2">
        <p className={cn("text-sm", tone === "navy" ? "text-white/70" : "text-muted-foreground")}>{label}</p>
        {Icon ? <Icon aria-hidden className={cn("size-4", tone === "navy" ? "text-brand" : "text-muted-foreground")} /> : null}
      </div>
      <p className="tabular mt-2 text-2xl font-semibold tracking-tight">{value}</p>
      {hint ? <p className={cn("mt-1 text-xs", tone === "navy" ? "text-white/60" : "text-muted-foreground")}>{hint}</p> : null}
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  groceries: "Groceries", dining: "Dining", transport: "Transport", shopping: "Shopping", utilities: "Utilities",
  entertainment: "Entertainment", health: "Health", salary: "Salary", deposit: "Deposit", transfer: "Transfer",
  fee: "Fees", rent: "Rent", other: "Other",
};
export const categoryLabel = (c: string) => CATEGORY_LABEL[c] ?? "Other";
export const CATEGORIES = Object.keys(CATEGORY_LABEL);
