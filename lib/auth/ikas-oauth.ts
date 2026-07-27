import { env } from "@/lib/config/env";

/**
 * ikas OAuth helpers. Authorize → exchange code for access/refresh tokens
 * against the ikas auth server. Endpoints follow the ikas app-examples pattern;
 * the store-specific auth host is derived from the storeId/domain at runtime.
 */

const IKAS_AUTH_BASE = "https://api.myikas.com/api/v1/admin/oauth";

export function buildAuthorizeUrl(args: {
  storeName: string;
  state: string;
  redirectUri: string;
  scopes?: string[];
}): string {
  const scopes = args.scopes ?? [
    "read_orders",
    "read_products",
    "read_customers",
    "write_webhooks",
  ];
  const params = new URLSearchParams({
    client_id: env.ikasClientId ?? "",
    redirect_uri: args.redirectUri,
    response_type: "code",
    state: args.state,
    scope: scopes.join(" "),
  });
  // ikas stores authorize on their merchant auth host.
  return `https://${args.storeName}.myikas.com/api/admin/oauth/authorize?${params.toString()}`;
}

export interface IkasTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number; // seconds
  token_type: string;
}

export async function exchangeCodeForToken(args: {
  code: string;
  redirectUri: string;
}): Promise<IkasTokenResponse> {
  const res = await fetch(`${IKAS_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      client_id: env.ikasClientId ?? "",
      client_secret: env.ikasClientSecret ?? "",
      redirect_uri: args.redirectUri,
      code: args.code,
    }),
  });
  if (!res.ok) {
    throw new Error(`ikas token exchange failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as IkasTokenResponse;
}

/**
 * Private-app ("Özel Uygulama") flow: no browser redirect, the app exchanges
 * its client id+secret directly for a store-scoped token. This is how an app
 * created in the STORE admin (Ayarlar → Uygulamalar → Özel Uygulama) connects —
 * such apps have no redirect URI at all.
 *
 * The token endpoint lives on the store's own domain per the ikas app
 * examples; the central v1 endpoint is tried as a fallback since neither has
 * been validated live yet. Whichever answers 2xx wins.
 */
export async function clientCredentialsToken(
  storeName: string
): Promise<IkasTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.ikasClientId ?? "",
    client_secret: env.ikasClientSecret ?? "",
  });
  const endpoints = [
    `https://${storeName}.myikas.com/api/admin/oauth/token`,
    `${IKAS_AUTH_BASE}/token`,
  ];

  let lastError = "";
  for (const url of endpoints) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    if (res.ok) return (await res.json()) as IkasTokenResponse;
    lastError = `${url} → ${res.status} ${await res.text()}`;
    console.warn("[ikas:client-credentials] endpoint failed:", lastError);
  }
  throw new Error(`ikas client_credentials failed: ${lastError}`);
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<IkasTokenResponse> {
  const res = await fetch(`${IKAS_AUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: env.ikasClientId ?? "",
      client_secret: env.ikasClientSecret ?? "",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    throw new Error(`ikas token refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as IkasTokenResponse;
}
