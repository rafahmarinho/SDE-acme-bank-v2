import {
  ArrowLeftRight, CalendarClock, CreditCard, FileText, FlaskConical, House, Inbox, LifeBuoy, ScrollText,
  Settings, ShieldCheck, User, Users, Wallet,
} from "lucide-react";
import type { NavIcon as NavIconName } from "./nav-config";

const ICONS = {
  home: House, wallet: Wallet, send: ArrowLeftRight, users: Users, calendar: CalendarClock, card: CreditCard,
  file: FileText, help: LifeBuoy, shield: ShieldCheck, flask: FlaskConical, settings: Settings, user: User,
  inbox: Inbox, scroll: ScrollText,
} as const;

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
  const Icon = ICONS[name];
  return <Icon aria-hidden className={className} />;
}
