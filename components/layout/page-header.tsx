import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/** The white rounded header bar with an icon chip + title + subtitle. */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-card",
        className
      )}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-brand-700">
            <Icon className="size-5" />
          </div>
        )}
        <div>
          <h1 className="text-base font-semibold tracking-tight text-foreground">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}
