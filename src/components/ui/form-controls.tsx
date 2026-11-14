/**
 * shadcn/ui-style form controls: Input, Textarea, NativeSelect, Label.
 * NativeSelect keeps forms working as plain HTML forms (server actions, GET filter forms).
 */
import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full min-w-0 rounded-lg border border-input bg-card text-sm shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return <input type={type} data-slot="input" className={cn(fieldBase, "flex h-10 px-3 py-2", className)} {...props} />;
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return <textarea data-slot="textarea" className={cn(fieldBase, "flex min-h-24 px-3 py-2", className)} {...props} />;
}

function NativeSelect({ className, children, ...props }: React.ComponentProps<"select">) {
  return (
    <div className="relative w-full">
      <select data-slot="select" className={cn(fieldBase, "h-10 appearance-none py-2 pr-9 pl-3", className)} {...props}>
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return <label data-slot="label" className={cn("text-sm leading-none font-medium select-none", className)} {...props} />;
}

/** Label + control + optional hint/error, with consistent spacing. */
function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid gap-1.5", className)}>
      <Label htmlFor={htmlFor}>
        {label}
        {required ? <span className="text-brand"> *</span> : <span className="font-normal text-muted-foreground"> (optional)</span>}
      </Label>
      {children}
      {error ? <p className="text-xs text-destructive">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export { Field, Input, Label, NativeSelect, Textarea };
