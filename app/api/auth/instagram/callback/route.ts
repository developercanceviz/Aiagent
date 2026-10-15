import { NextRequest, NextResponse } from "next/server";

import { env, isConfigured } from "@/lib/config/env";
import {
  exchangeForLongLivedToken,
  exchangeInstagramCode,
  getInstagramProfile,
} from "@/lib/auth/instagram-oauth";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { encryptSecret } from "@/lib/crypto/secrets";
import type { ChannelCredentials } from "@/lib/db/channel";

/**
 * OAuth callback: validate state → exchange code for a short-lived token →
 * exchange that for a long-lived one (~60 days) → identify the connected IG
 * account → upsert this merchant's INSTAGRAM Channel with the encrypted
 * token + its real expiry. Mirrors app/api/auth/ikas/callback/route.ts.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured.instagramOAuth()) {
    return NextResponse.json({ error: "Instagram OAuth is not configured." }, { status: 503 });
  }

  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");

  const session = await getSession();
  if (!session.merchantId) {
    return NextResponse.json({ error: "No store in session." }, { status: 401 });
  }
  if (!code) {
    const errorDescription = params.get("error_description") ?? params.get("error");
    return NextResponse.json(
      { error: "Missing authorization code", detail: errorDescription },
      { status: 400 }
    );
  }
  if (!state || state !== session.instagramOauthState) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
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
    where: { merchantId: session.merchantId, type: "INSTAGRAM" },
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
        merchantId: session.merchantId,
        type: "INSTAGRAM",
        displayName: `@${profile.username}`,
        externalId: profile.id,
        credentials: encryptSecret(JSON.stringify(credentials)),
        tokenExpiresAt,
        status: "CONNECTED",
      },
    });
  }

  session.instagramOauthState = undefined;
  await session.save();

  return NextResponse.redirect(`${env.deployUrl}/ayarlar/kanallar?instagram=connected`);
}
