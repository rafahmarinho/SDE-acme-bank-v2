/** Skeleton, Separator and Alert (shadcn/ui style). */
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

function Separator({ className, ...props }: React.ComponentProps<"hr">) {
  return <hr data-slot="separator" className={cn("border-0 border-t border-border", className)} {...props} />;
}

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 [&>svg]:size-4 [&>svg]:translate-y-0.5",
  {
    variants: {
      variant: {
        default: "bg-card text-card-foreground",
        info: "border-primary/15 bg-secondary text-secondary-foreground",
        success: "border-success/30 bg-success/8 text-[oklch(0.42_0.1_155)]",
        warning: "border-warning/50 bg-warning/10 text-[oklch(0.45_0.11_65)]",
        destructive: "border-destructive/25 bg-destructive/6 text-destructive",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({ className, variant, ...props }: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role={variant === "destructive" ? "alert" : "status"} className={cn(alertVariants({ variant }), className)} {...props} />;
}
function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-title" className={cn("col-start-2 font-medium", className)} {...props} />;
}
function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("col-start-2 text-sm opacity-90", className)} {...props} />;
}

export { Alert, AlertDescription, AlertTitle, Separator, Skeleton };
