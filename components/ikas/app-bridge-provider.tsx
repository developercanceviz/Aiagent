"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

/**
 * ikas App Bridge bootstrap.
 *
 * Only does anything when the app is actually framed by ikas. Standalone runs
 * detect no parent frame, mark themselves not-embedded, and behave exactly as
 * before — this must never degrade the standalone deployment.
 *
 * Responsibilities when embedded:
 *   1. closeLoader() — mandatory; ikas' spinner stays up forever otherwise.
 *   2. Fetch a session JWT and keep it in memory (never localStorage — these
 *      are bearer credentials and localStorage is readable by any injected
 *      script).
 */

interface AppBridgeState {
  embedded: boolean;
  token: string | null;
  ready: boolean;
}

const AppBridgeContext = createContext<AppBridgeState>({
  embedded: false,
  token: null,
  ready: false,
});

export function useAppBridge() {
  return useContext(AppBridgeContext);
}

/** True only in a browser that is genuinely inside a parent frame. */
function detectEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    // Cross-origin access to window.top throws — which itself means we're framed.
    return true;
  }
}

export function AppBridgeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppBridgeState>({
    embedded: false,
    token: null,
    ready: false,
  });

  useEffect(() => {
    const embedded = detectEmbedded();
    if (!embedded) {
      setState({ embedded: false, token: null, ready: true });
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        // Imported lazily so the standalone bundle never pays for it and the
        // module's window access can't run during SSR.
        const { AppBridgeHelper } = await import("@ikas/app-helpers");

        AppBridgeHelper.closeLoader();

        const token = await AppBridgeHelper.getNewToken();
        if (!cancelled) {
          setState({ embedded: true, token: token ?? null, ready: true });
        }
      } catch (err) {
        console.error("[app-bridge] bootstrap failed", err);
        if (!cancelled) setState({ embedded: true, token: null, ready: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppBridgeContext.Provider value={state}>{children}</AppBridgeContext.Provider>
  );
}
