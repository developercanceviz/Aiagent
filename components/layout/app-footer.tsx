import { DevCredit } from "@/components/layout/dev-credit";

/**
 * Full-width footer bar pinned under the sidebar + content row. The developer
 * credit used to live squeezed into the bottom of the sidebar, where a short
 * viewport clipped it; centered across the whole app it always has room.
 */
export function AppFooter() {
  return (
    <footer className="flex h-12 shrink-0 items-center justify-center border-t border-border/60 bg-card px-4">
      <DevCredit />
    </footer>
  );
}
