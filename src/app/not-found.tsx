import { SearchX } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="grid min-h-[70dvh] place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-accent text-accent-foreground"><SearchX aria-hidden className="size-7" /></span>
        <h1 className="mt-4 text-2xl font-semibold text-primary">We couldn&apos;t find that page</h1>
        <p className="mt-2 text-sm text-muted-foreground">It may have moved, or you may not have access to it.</p>
        <Button asChild className="mt-6"><Link href="/">Back to ACME Bank</Link></Button>
      </div>
    </main>
  );
}
