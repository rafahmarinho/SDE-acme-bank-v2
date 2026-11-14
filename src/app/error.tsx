"use client";
/** Route error boundary: generic message only - no stack traces or internal details (T2139, T49). */
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="grid min-h-[60dvh] place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive"><TriangleAlert aria-hidden className="size-7" /></span>
        <h1 className="mt-4 text-2xl font-semibold text-primary">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">We couldn&apos;t load this page. Please try again in a moment.</p>
        {error.digest ? <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {error.digest}</p> : null}
        <Button className="mt-6" onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
