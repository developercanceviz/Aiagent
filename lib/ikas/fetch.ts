"use client";

/**
 * fetch() wrapper that authenticates against our own API in both run modes.
 *
 * Embedded  — attaches a fresh ikas App Bridge JWT as a Bearer token.
 * Standalone — plain fetch; the iron-session cookie travels same-site.
 *
 * A fresh token is requested per call rather than reusing a cached one: App
 * Bridge tokens are short-lived, and a stale token fails verification server
 * side, which would look like a random auth error to the user.
 */

function isEmbedded(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export async function ikasFetch(
  input: RequestInfo | URL,
  init: RequestInit = {}
): Promise<Response> {
  if (!isEmbedded()) return fetch(input, init);

  let token: string | undefined;
  try {
    const { AppBridgeHelper } = await import("@ikas/app-helpers");
    token = await AppBridgeHelper.getNewToken();
  } catch (err) {
    console.error("[ikas-fetch] could not obtain session token", err);
  }

  if (!token) return fetch(input, init);

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
