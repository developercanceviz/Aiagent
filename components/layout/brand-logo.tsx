import { cn } from "@/lib/utils";
import { brandConfig } from "@/lib/config/brand";

/**
 * Configurable brand wordmark. Default = agency brand (NOT "Creato").
 * Swap `brandConfig.wordmark` or pass `label` to rebrand per deployment.
 */
export function BrandLogo({
  className,
  label = brandConfig.wordmark,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <span
      className={cn(
        "select-none text-sm font-semibold tracking-[0.18em] text-foreground",
        className
      )}
    >
      {label}
    </span>
  );
}

/** The small dark square mark used in the topbar lockup. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex size-9 items-center justify-center rounded-xl bg-ink",
        className
      )}
      aria-hidden
    >
      <div className="flex flex-col gap-[3px]">
        <span className="block h-[3px] w-4 rounded-full bg-primary" />
        <span className="block h-[3px] w-4 rounded-full bg-white" />
        <span className="block h-[3px] w-4 rounded-full bg-white" />
      </div>
    </div>
  );
}
