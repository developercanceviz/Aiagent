import { cn } from "@/lib/utils";
import { brandConfig } from "@/lib/config/brand";

/**
 * Configurable brand lockup. Renders /logo.jpeg (drop a new file in /public to
 * rebrand); the wordmark from brandConfig stays as the accessible name.
 */
export function BrandLogo({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static local asset
    <img
      src="/logo.jpeg"
      alt={brandConfig.name}
      // The asset is a square export with the wordmark as a centered band and
      // wide empty margins; cropping to that band keeps the mark readable at
      // nav size instead of shrinking the whole square down to 32px.
      style={{ aspectRatio: "4.5 / 1" }}
      className={cn("h-8 w-auto select-none object-cover", className)}
    />
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
