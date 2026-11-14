import Link from "next/link";
import { Brand } from "@/components/app/brand";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="bg-navy-900 px-6 py-4"><Link href="/login"><Brand /></Link></header>
      <main className="mx-auto max-w-3xl px-6 py-10 text-sm leading-relaxed [&_h1]:text-3xl [&_h1]:font-semibold [&_h1]:text-primary [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-primary [&_li]:mt-1 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">
        {children}
      </main>
    </div>
  );
}
