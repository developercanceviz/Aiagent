import {
  LayoutGrid,
  Users,
  MessageCircle,
  BookOpen,
  Megaphone,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { Dictionary } from "@/lib/i18n";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: (t: Dictionary) => string;
}

export const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutGrid, label: (t) => t.nav.dashboard },
  { href: "/crm", icon: Users, label: (t) => t.nav.crm },
  { href: "/mesajlar", icon: MessageCircle, label: (t) => t.nav.messages },
  // Where merchants load FAQs/policies and upload documents for the agent —
  // previously only reachable from a dashboard quick-link, so it went unfound.
  { href: "/bilgi-bankasi", icon: BookOpen, label: (t) => t.nav.knowledge },
  { href: "/duyurular", icon: Megaphone, label: (t) => t.nav.announcements },
  { href: "/ayarlar", icon: Settings, label: (t) => t.nav.settings },
];
