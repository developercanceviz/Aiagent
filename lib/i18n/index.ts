import { tr, type Dictionary } from "./locales/tr";

export type Locale = "tr" | "en" | "de" | "ar";

export const defaultLocale: Locale = "tr";
export const locales: Locale[] = ["tr", "en", "de", "ar"];

/**
 * Dictionary registry. TR is the only fully-translated locale in Phase 0;
 * others fall back to TR until their files land (en.ts/de.ts/ar.ts mirror
 * the `Dictionary` shape, giving compile-time parity).
 */
const dictionaries: Record<Locale, Dictionary> = {
  tr,
  en: tr,
  de: tr,
  ar: tr,
};

export function getDictionary(locale: Locale = defaultLocale): Dictionary {
  return dictionaries[locale] ?? tr;
}

export type { Dictionary };
