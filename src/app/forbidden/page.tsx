import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Access denied" };

/** Rendered (with HTTP 403) by the proxy when a role tries to open an area it can't access. */
export default function Forbidden() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-md text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-destructive/10 text-destructive"><ShieldAlert aria-hidden className="size-7" /></span>
        <h1 className="mt-4 text-2xl font-semibold text-primary">You don&apos;t have access to this page</h1>
        <p className="mt-2 text-sm text-muted-foreground">This area is limited to other roles. If you think this is a mistake, contact your administrator.</p>
        <Button asChild className="mt-6"><Link href="/">Go to my home page</Link></Button>
      </div>
    </main>
  );
}
