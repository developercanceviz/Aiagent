"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, Sparkles, ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { useAppBridge } from "@/components/ikas/app-bridge-provider";
import { navItems } from "@/lib/config/nav";
import { demoStore } from "@/lib/config/brand";
import { BrandLogo } from "@/components/layout/brand-logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * Inside the ikas admin iframe, App-Router client navigation does not take
 * effect — the click registers but the view never changes, and only a manual
 * refresh lands on the target page. Full document navigation always works
 * there, so embedded mode uses plain anchors. Standalone keeps SPA routing.
 */
function NavAnchor({
  href,
  embedded,
  className,
  children,
}: {
  href: string;
  embedded: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (embedded) {
    return (
      <a href={href} className={className}>
        {children}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {children}
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();
  const { embedded } = useAppBridge();
  const [collapsed, setCollapsed] = React.useState(false);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={cn(
        "relative m-3 flex min-h-0 shrink-0 flex-col rounded-2xl border border-border/60 bg-card shadow-card transition-[width] duration-200",
        collapsed ? "w-[72px] items-center" : "w-64"
      )}
    >
      {/* Brand + collapse toggle */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 pt-4",
          collapsed ? "justify-center px-0" : "justify-between"
        )}
      >
        {!collapsed && <BrandLogo />}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? "Genişlet" : "Daralt"}
          className={cn(
            "flex size-7 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:bg-accent",
            collapsed && "bg-primary text-primary-foreground border-transparent"
          )}
        >
          {collapsed ? (
            <ChevronRight className="size-4" />
          ) : (
            <ChevronLeft className="size-4" />
          )}
        </button>
      </div>

      {/* Assistant card (dark "Soru Sor") */}
      <div className={cn("px-3 pt-4", collapsed && "px-2")}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <NavAnchor
                href="/asistan"
                embedded={embedded}
                className="flex size-11 items-center justify-center rounded-xl bg-ink text-ink-foreground transition-transform hover:scale-105"
              >
                <Sparkles className="size-5 text-primary" />
              </NavAnchor>
            </TooltipTrigger>
            <TooltipContent side="right">{t.assistant.title}</TooltipContent>
          </Tooltip>
        ) : (
          <div className="rounded-2xl bg-ink p-3.5 text-ink-foreground">
            <p className="text-[10px] font-medium tracking-widest text-white/50">
              {t.assistant.label}
            </p>
            <p className="mt-1 text-sm font-semibold">{t.assistant.title}</p>
            <NavAnchor
              href="/asistan"
              embedded={embedded}
              className="mt-3 flex h-9 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-600"
            >
              {t.assistant.cta}
              <ArrowRight className="size-4" />
            </NavAnchor>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav
        // min-h-0 + scroll keeps the store block pinned at the bottom instead
        // of being pushed off the viewport on short screens.
        className={cn(
          "flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-3 pt-5",
          collapsed && "items-center px-2"
        )}
      >
        {!collapsed && (
          <p className="px-3 pb-1 text-[10px] font-medium tracking-widest text-muted-foreground">
            {t.nav.menu}
          </p>
        )}
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const link = (
            <NavAnchor
              key={item.href}
              href={item.href}
              embedded={embedded}
              className={cn(
                "flex items-center gap-3 rounded-xl text-sm font-medium transition-colors",
                collapsed ? "size-11 justify-center" : "h-10 px-3",
                active
                  ? "bg-ink text-ink-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              <Icon className="size-[18px] shrink-0" />
              {!collapsed && <span>{item.label(t)}</span>}
            </NavAnchor>
          );
          return collapsed ? (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{link}</TooltipTrigger>
              <TooltipContent side="right">{item.label(t)}</TooltipContent>
            </Tooltip>
          ) : (
            link
          );
        })}
      </nav>

      {/* User / store handle */}
      <div className={cn("border-t border-border/60 p-3", collapsed && "px-2")}>
        <div className={cn("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="relative">
            <Avatar className="size-9">
              <AvatarFallback>
                {demoStore.handle.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-card bg-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {demoStore.handle}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {demoStore.domain}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
