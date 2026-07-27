import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind class names, resolving conflicts intelligently. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number as Turkish Lira (e.g. ₺1.234,50). */
export function formatTRY(value: number): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency: "TRY",
    maximumFractionDigits: 2,
  }).format(value);
}

/** Compact integer formatting (1.234) in tr-TR locale. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat("tr-TR").format(value);
}

/** Relative time in Turkish ("3 dk", "2 sa", "Dün"). */
export function relativeTimeTR(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diffMs = Date.now() - d.getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "şimdi";
  if (min < 60) return `${min} dk`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} sa`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Dün";
  if (day < 7) return `${day} gün`;
  return d.toLocaleDateString("tr-TR", { day: "numeric", month: "short" });
}
