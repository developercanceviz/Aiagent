"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Link2, MessageSquareText, Zap } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";

export function SettingsNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  const items = [
    { href: "/ayarlar/ai-agent", icon: Bot, label: t.settings.aiAgent },
    { href: "/ayarlar/kanallar", icon: Link2, label: t.settings.channels },
    { href: "/ayarlar/web-chat", icon: MessageSquareText, label: t.settings.webChat },
    { href: "/ayarlar/hazir-mesajlar", icon: Zap, label: t.settings.quickReplies },
  ];

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-2xl border border-border/60 bg-card p-1.5 shadow-card">
      {items.map((item) => {
        const active = pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-ink text-ink-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
