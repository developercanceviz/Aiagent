import { jwtVerify } from "jose";

import { env } from "@/lib/config/env";

/**
 * ikas App Bridge session tokens.
 *
 * When the app runs embedded in the ikas admin panel, ikas does NOT send a
 * cookie — the iframe is cross-site, so cookies are unreliable (Safari blocks
 * third-party cookies outright). Instead the frontend asks App Bridge for a
 * short-lived JWT (`AppBridgeHelper.getNewToken()`) and sends it as a Bearer
 * token on every request. This module is the server-side half: verify that
 * token and derive the tenant from it.
 *
 * Claims (per ikas' App Actions guide):
 *   sub / merchantId       — the store, i.e. our tenant key
 *   aud / authorizedAppId  — which app installation issued it
 *   exp                    — expiry
 *
 * ⚠️ ikas does not publish which key signs these tokens. The app client secret
 * (HS256) is the documented-by-convention choice and what the official examples
 * imply, but this MUST be validated against a real token from a live install —
 * see verifyIkasSessionToken's failure logging.
 */

export interface IkasSessionToken {
  merchantId: string;
  authorizedAppId?: string;
  expiresAt?: number;
}

/** Pull the Bearer token off a request, if the caller sent one. */
export function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header?.toLowerCase().startsWith("bearer ")) return null;
  const token = header.slice(7).trim();
  return token.length > 0 ? token : null;
}

/**
 * Verify an App Bridge token. Returns null on any failure — never throws, and
 * never trusts an unverified payload. A null result means "no embedded
 * context", and the caller falls back to the cookie session.
 */
export async function verifyIkasSessionToken(
  token: string
): Promise<IkasSessionToken | null> {
  const secret = env.ikasClientSecret;
  if (!secret) return null;

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret),
      { algorithms: ["HS256"] }
    );

    // ikas puts the store id in `merchantId`; `sub` is the documented alias.
    const merchantId =
      typeof payload.merchantId === "string"
        ? payload.merchantId
        : typeof payload.sub === "string"
          ? payload.sub
          : null;
    if (!merchantId) return null;

    const authorizedAppId =
      typeof payload.authorizedAppId === "string"
        ? payload.authorizedAppId
        : typeof payload.aud === "string"
          ? payload.aud
          : undefined;

    return { merchantId, authorizedAppId, expiresAt: payload.exp };
  } catch (err) {
    // Signature/expiry failures are expected noise (stale tokens); log the
    // reason without the token itself so a wrong signing key is diagnosable.
    console.warn(
      "[ikas:jwt] session token rejected:",
      err instanceof Error ? err.message : "unknown"
    );
    return null;
  }
}
