import { getIronSession, type SessionOptions } from "iron-session";
import { cookies } from "next/headers";

/**
 * Iron Session — encrypted, server-side cookie holding the ikas app context
 * (which merchant this browser session is acting as). Mirrors the ikas
 * app-examples OAuth approach. SECRET_COOKIE_PASSWORD must be >=32 chars.
 */
export interface AppSession {
  merchantId?: string;
  /** CSRF/state for the OAuth round-trip. */
  oauthState?: string;
  storeId?: string;
}

const isProd = process.env.NODE_ENV === "production";

export const sessionOptions: SessionOptions = {
  password: process.env.SECRET_COOKIE_PASSWORD ?? "dev-only-insecure-password-change-me-32+",
  cookieName: "canceviz_session",
  cookieOptions: {
    secure: isProd,
    httpOnly: true,
    // The app also runs embedded in the ikas admin iframe (cross-site), where
    // Lax cookies are never sent — the session bootstrap
    // (/api/auth/ikas/session) sets this cookie from inside the frame and
    // needs None to be readable there. `partitioned` (CHIPS) keeps the
    // embedded copy scoped to the ikas top-level site, which is what lets
    // Safari accept it. Dev stays Lax: None requires Secure, and localhost
    // is http.
    sameSite: isProd ? "none" : "lax",
    ...(isProd ? { partitioned: true } : {}),
  },
};

export async function getSession() {
  const cookieStore = await cookies();
  return getIronSession<AppSession>(cookieStore, sessionOptions);
}

/**
 * Derive the active tenant from the session. NEVER read merchantId from the
 * request body/query — only from here (or Supabase Auth).
 */
export async function getCurrentMerchantId(): Promise<string | null> {
  const session = await getSession();
  return session.merchantId ?? null;
}
