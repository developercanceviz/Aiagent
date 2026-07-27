"use client";

import * as React from "react";

import { getDictionary, type Dictionary, type Locale } from "./index";

const I18nContext = React.createContext<{ locale: Locale; t: Dictionary }>({
  locale: "tr",
  t: getDictionary("tr"),
});

export function I18nProvider({
  locale = "tr",
  children,
}: {
  locale?: Locale;
  children: React.ReactNode;
}) {
  const value = React.useMemo(
    () => ({ locale, t: getDictionary(locale) }),
    [locale]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/** Access the active dictionary in client components: `const { t } = useI18n()`. */
export function useI18n() {
  return React.useContext(I18nContext);
}
