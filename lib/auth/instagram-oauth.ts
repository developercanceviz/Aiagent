import { env } from "@/lib/config/env";

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
  permissions?: string[];
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
  return (await res.json()) as ShortLivedTokenResponse;
}

export interface LongLivedTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number; // seconds, ~60 days
}

/** short-lived token → long-lived token (valid ~60 days, refreshable up to
 *  that expiry via refreshLongLivedToken — NOT after, confirmed live). */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<LongLivedTokenResponse> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: env.instagramAppSecret ?? "",
    access_token: shortLivedToken,
  });
  const res = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`);
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
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params.toString()}`);
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
