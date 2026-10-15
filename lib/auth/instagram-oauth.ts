import { randomUUID } from "node:crypto";

import { env } from "@/lib/config/env";
import { encryptSecret, decryptSecret } from "@/lib/crypto/secrets";

/**
 * "Instagram API with Instagram Login" OAuth helpers — a standalone login
 * flow distinct from Facebook Login for Business, tokens from this flow are
 * prefixed "IGAA" and only valid against graph.instagram.com (NOT
 * graph.facebook.com). Mirrors lib/auth/ikas-oauth.ts's structure.
 *
 * Built after two live incidents from manually pasting tokens: once an
 * already-expired token (no refresh/expiry tracking anywhere), then a
 * Facebook user token with zero Page access pasted in its place — Meta's own
 * token tooling makes that mistake easy. This flow removes the manual step
 * entirely: the merchant clicks connect, approves on Instagram's real
 * consent screen, and the right kind of token is captured automatically.
 */

const SCOPES = "instagram_business_basic,instagram_business_manage_messages";

/**
 * The OAuth `state` param doubles as the CSRF token AND the only reliable
 * way to carry the merchant's identity across this round-trip: the whole
 * dashboard runs inside ikas's admin iframe, and the session cookie is
 * scoped to that embedding (CHIPS-partitioned) — the moment the browser
 * leaves for Instagram's consent screen (same tab or a new one; Instagram
 * refuses to be framed at all, confirmed live), it's a different top-level
 * context and the cookie simply isn't sent. AES-GCM's auth tag makes this
 * tamper-evident, not just opaque — decrypt fails outright on any edit.
 */
export function signInstagramOAuthState(merchantId: string): string {
  const payload = JSON.stringify({
    merchantId,
    nonce: randomUUID(),
    exp: Date.now() + 10 * 60 * 1000, // 10 minutes — generous for a login+approve click-through
  });
  return encryptSecret(payload);
}

/** Returns the merchantId if `state` is well-formed, untampered, and not
 *  expired; null otherwise (never throws — a bad state is just a failed
 *  connect attempt, not a server error). */
export function verifyInstagramOAuthState(state: string): string | null {
  try {
    const payload = JSON.parse(decryptSecret(state)) as {
      merchantId?: string;
      exp?: number;
    };
    if (!payload.merchantId || !payload.exp || Date.now() > payload.exp) return null;
    return payload.merchantId;
  } catch {
    return null;
  }
}

export function buildInstagramAuthorizeUrl(args: {
  state: string;
  redirectUri: string;
}): string {
  const params = new URLSearchParams({
    client_id: env.instagramAppId ?? "",
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: SCOPES,
    state: args.state,
  });
  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

interface ShortLivedTokenResponse {
  access_token: string;
  user_id: string;
  permissions?: string;
}

/**
 * api.instagram.com/oauth/access_token wraps its result in a `data` array —
 * {"data":[{"access_token":"...","user_id":"...","permissions":"..."}]} —
 * confirmed against Meta's own docs after a live failure: the un-wrapped
 * shape was assumed here, so `access_token` read as undefined and the
 * literal string "undefined" got sent as the token on the next call. Meta's
 * error for that was the unhelpful "Unsupported request - method type: get"
 * (IGApiException code 100) — worth remembering if that message resurfaces,
 * since it does not actually mean what it says.
 */
interface ShortLivedTokenApiResponse {
  data: ShortLivedTokenResponse[];
}

/** code → short-lived token (valid ~1 hour). Must be exchanged for a
 *  long-lived one immediately — see exchangeForLongLivedToken below. */
export async function exchangeInstagramCode(args: {
  code: string;
  redirectUri: string;
}): Promise<ShortLivedTokenResponse> {
  const body = new URLSearchParams({
    client_id: env.instagramAppId ?? "",
    client_secret: env.instagramAppSecret ?? "",
    grant_type: "authorization_code",
    redirect_uri: args.redirectUri,
    code: args.code,
  });
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Instagram code exchange failed: ${res.status} ${await res.text()}`);
  }
  const json = (await res.json()) as ShortLivedTokenApiResponse | ShortLivedTokenResponse;
  const result = "data" in json ? json.data[0] : json;
  if (!result?.access_token) {
    throw new Error(`Instagram code exchange returned no access_token: ${JSON.stringify(json)}`);
  }
  return result;
}

export interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds, ~60 days
}

/**
 * short-lived token → long-lived token (valid ~60 days, refreshable up to
 * that expiry via refreshLongLivedToken — NOT after, confirmed live).
 *
 * Meta's own docs show this as a GET — confirmed wrong live, twice, with the
 * token itself verified correct both times (ruled out by fixing the data[]
 * unwrap bug first and re-testing): GET gets "Unsupported request - method
 * type: get" (IGApiException code 100) regardless. Sending the identical
 * params as POST instead, matching the exchangeInstagramCode call that does
 * work.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<LongLivedTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: env.instagramAppSecret ?? "",
    access_token: shortLivedToken,
  });
  const res = await fetch("https://graph.instagram.com/v21.0/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Instagram long-lived token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as LongLivedTokenResponse;
}

/** Re-extends a still-valid long-lived token for another ~60 days. Returns
 *  null once the token has actually expired — confirmed live (2026-10-15):
 *  this endpoint 400s with "Session has expired" the same as any other call,
 *  it does not resurrect a dead token. Call this well before expiry. */
export async function refreshLongLivedInstagramToken(
  currentToken: string
): Promise<LongLivedTokenResponse | null> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: currentToken,
  });
  const res = await fetch(`https://graph.instagram.com/v21.0/refresh_access_token?${params.toString()}`);
  if (!res.ok) return null;
  return (await res.json()) as LongLivedTokenResponse;
}

/** The connected Instagram professional account's own id + @handle. */
export async function getInstagramProfile(
  accessToken: string
): Promise<{ id: string; username: string }> {
  const res = await fetch(
    `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${encodeURIComponent(accessToken)}`
  );
  if (!res.ok) {
    throw new Error(`Instagram profile lookup failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as { id: string; username: string };
}
