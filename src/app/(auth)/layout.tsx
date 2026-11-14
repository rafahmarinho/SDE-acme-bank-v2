import { ShieldCheck, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { Brand } from "@/components/app/brand";

const POINTS = [
  { icon: Zap, title: "Move money in seconds", text: "Transfers with the fee shown before you confirm." },
  { icon: ShieldCheck, title: "Your card, your rules", text: "Block your card or change limits any time." },
  { icon: Sparkles, title: "Always up to date", text: "Balances and activity update live." },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-navy-900 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -top-32 -right-24 size-[28rem] rounded-full bg-brand/20 blur-3xl" />
        <div aria-hidden className="absolute -bottom-40 -left-20 size-[26rem] rounded-full bg-navy-700/60 blur-3xl" />
        <Link href="/login" className="relative"><Brand /></Link>
        <div className="relative max-w-md">
          <h1 className="text-4xl leading-tight font-semibold tracking-tight">Banking that keeps up with you.</h1>
          <ul className="mt-10 grid gap-6">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-white/10 text-brand"><Icon aria-hidden className="size-5" /></span>
                <span>
                  <span className="block font-medium">{title}</span>
                  <span className="text-sm text-white/70">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-xs text-white/50">ACME Bank is a product simulation. No real money, cards or identity checks are involved.</p>
      </section>
      <section className="flex flex-col">
        <div className="bg-navy-900 px-6 py-4 lg:hidden"><Link href="/login"><Brand /></Link></div>
        <div className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-md">{children}</div>
        </div>
        <footer className="flex flex-wrap justify-center gap-4 px-6 pb-6 text-xs text-muted-foreground">
          <Link href="/legal/terms" className="hover:text-foreground">Terms of Service</Link>
          <Link href="/legal/privacy" className="hover:text-foreground">Privacy Notice</Link>
          <span>© {new Date().getUTCFullYear()} ACME Bank (simulation)</span>
        </footer>
      </section>
    </div>
  );
}
