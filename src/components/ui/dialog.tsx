"use client";
/**
 * Modal dialog on the native <dialog> element: the browser provides the focus trap, Esc-to-close and
 * an inert background. No runtime <style> injection, so it works under the nonce-based CSP (T66).
 */
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  const ref = React.useRef<HTMLDialogElement>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={() => onOpenChange(false)}
      onClick={(e) => {
        if (e.target === ref.current) onOpenChange(false); // backdrop click
      }}
      className={cn("m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border bg-card p-0 text-card-foreground shadow-xl", className)}
    >
      {open ? (
        <div className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
              {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
            </div>
            <button type="button" onClick={() => onOpenChange(false)} className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
          {children}
        </div>
      ) : null}
    </dialog>
  );
}

export { Dialog };
