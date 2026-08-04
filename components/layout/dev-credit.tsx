import { cn } from "@/lib/utils";

/**
 * "PakSoft tarafından geliştirildi" credit badge (crescent + wordmark pill).
 * variant="light" for white surfaces (sidebar, widget); "dark" for ink/charcoal.
 */
export function DevCredit({
  variant = "light",
  className,
}: {
  variant?: "light" | "dark";
  className?: string;
}) {
  const light = variant === "light";
  return (
    <a
      href="https://paksofts.com"
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs leading-none no-underline transition-colors",
        light
          ? "border-black/10 bg-black/[0.04] hover:bg-black/[0.08]"
          : "border-white/10 bg-white/5 hover:bg-white/10",
        className
      )}
    >
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
        className={cn(
          "size-3.5 shrink-0 -rotate-12 transition-colors group-hover:text-[#C89A4B]",
          light ? "text-[#161B1F]" : "text-white"
        )}
      >
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c1.85 0 3.58-.5 5.08-1.38-.7.13-1.42.21-2.16.21-5.52 0-10-4.48-10-10S9.42 2.83 14.92 2.83c.74 0 1.46.08 2.16.21C15.58 2.5 13.85 2 12 2z" />
      </svg>
      <span
        className={cn(
          "font-extrabold tracking-wide transition-colors group-hover:text-[#C89A4B]",
          light ? "text-[#161B1F]" : "text-white"
        )}
      >
        PakSoft
      </span>
      <span className={light ? "text-black/55" : "text-white/60"}>
        tarafından geliştirildi
      </span>
    </a>
  );
}
