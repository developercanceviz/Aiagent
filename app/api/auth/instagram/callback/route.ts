import { NextRequest, NextResponse } from "next/server";

import { env, isConfigured } from "@/lib/config/env";
import {
  exchangeForLongLivedToken,
  exchangeInstagramCode,
  getInstagramProfile,
  verifyInstagramOAuthState,
} from "@/lib/auth/instagram-oauth";
import { prisma } from "@/lib/db/client";
import { encryptSecret } from "@/lib/crypto/secrets";
import type { ChannelCredentials } from "@/lib/db/channel";

/**
 * OAuth callback: validate state → exchange code for a short-lived token →
 * exchange that for a long-lived one (~60 days) → identify the connected IG
 * account → upsert the Channel for the merchant signed into `state` with the
 * encrypted token + its real expiry. Mirrors
 * app/api/auth/ikas/callback/route.ts, except the merchant identity comes
 * from `state` rather than the session cookie — this callback is reached
 * from a new top-level tab (Instagram refuses to be framed at all), which
 * doesn't share the ikas-iframe-scoped session cookie. See
 * signInstagramOAuthState's comment for why.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured.instagramOAuth()) {
    return NextResponse.json({ error: "Instagram OAuth is not configured." }, { status: 503 });
  }

  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");

  if (!code) {
    const errorDescription = params.get("error_description") ?? params.get("error");
    return NextResponse.json(
      { error: "Missing authorization code", detail: errorDescription },
      { status: 400 }
    );
  }
  const merchantId = state ? verifyInstagramOAuthState(state) : null;
  if (!merchantId) {
    return NextResponse.json(
      { error: "Invalid or expired OAuth state — please try connecting again." },
      { status: 400 }
    );
  }

  const redirectUri = `${env.deployUrl}/api/auth/instagram/callback`;

  let longLived;
  try {
    const shortLived = await exchangeInstagramCode({ code, redirectUri });
    longLived = await exchangeForLongLivedToken(shortLived.access_token);
  } catch (err) {
    console.error("[instagram:callback] token exchange failed", err);
    return NextResponse.json(
      {
        error: "Instagram token exchange failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 }
    );
  }

  let profile;
  try {
    profile = await getInstagramProfile(longLived.access_token);
  } catch (err) {
    console.error("[instagram:callback] profile lookup failed", err);
    return NextResponse.json(
      {
        error: "Could not identify the connected Instagram account",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 502 }
    );
  }

  const credentials: ChannelCredentials = {
    accessToken: longLived.access_token,
    igId: profile.id,
    apiBase: "instagram",
  };
  const tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000);

  const existing = await prisma.channel.findFirst({
    where: { merchantId, type: "INSTAGRAM" },
    select: { id: true },
  });
  if (existing) {
    await prisma.channel.update({
      where: { id: existing.id },
      data: {
        displayName: `@${profile.username}`,
        externalId: profile.id,
        credentials: encryptSecret(JSON.stringify(credentials)),
        tokenExpiresAt,
        status: "CONNECTED",
      },
    });
  } else {
    await prisma.channel.create({
      data: {
        merchantId,
        type: "INSTAGRAM",
        displayName: `@${profile.username}`,
        externalId: profile.id,
        credentials: encryptSecret(JSON.stringify(credentials)),
        tokenExpiresAt,
        status: "CONNECTED",
      },
    });
  }

  // This callback landed in a new top-level tab (not the ikas iframe) — show
  // a real confirmation page here rather than redirecting into /ayarlar,
  // which would just load the dashboard logged out (no session in this
  // tab) and confuse more than it helps. The merchant switches back to
  // their original embedded tab to see the result.
  return new NextResponse(
    `<!doctype html><html><head><meta charset="utf-8"><title>Instagram bağlandı</title></head>` +
      `<body style="font-family:system-ui;max-width:480px;margin:80px auto;text-align:center;color:#111">` +
      `<h2>✅ Instagram bağlandı</h2>` +
      `<p>@${profile.username} başarıyla bağlandı. Bu sekmeyi kapatıp panele dönebilirsiniz.</p>` +
      `</body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}
