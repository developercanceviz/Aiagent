import { NextRequest, NextResponse } from "next/server";

import { env, isConfigured } from "@/lib/config/env";
import { exchangeCodeForToken } from "@/lib/auth/ikas-oauth";
import { storeIkasTokens } from "@/lib/auth/ikas-token";
import { registerIkasWebhooks } from "@/lib/commerce/adapters/ikas/webhooks";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { encryptSecret } from "@/lib/crypto/secrets";
import { enqueue } from "@/lib/queue";

/**
 * OAuth callback: validate state, exchange the code, upsert the Merchant with
 * encrypted tokens, register webhooks, and kick off the initial product→KB
 * sync. Then bind the session to this merchant.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured.ikas()) {
    return NextResponse.json({ error: "ikas is not configured." }, { status: 503 });
  }

  const params = req.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const storeId = params.get("merchantId") ?? params.get("storeId") ?? "";
  const storeName = params.get("storeName") ?? "Mağaza";

  const session = await getSession();
  if (!code || !state || state !== session.oauthState) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  const redirectUri = `${env.deployUrl}/api/auth/ikas/callback`;
  const token = await exchangeCodeForToken({ code, redirectUri });

  // Upsert merchant (encrypt the access token at write time; refresh stored separately).
  const merchant = await prisma.merchant.upsert({
    where: { platform_externalStoreId: { platform: "IKAS", externalStoreId: storeId } },
    update: { storeName },
    create: {
      platform: "IKAS",
      externalStoreId: storeId,
      storeName,
      accessToken: encryptSecret(token.access_token),
    },
  });

  await storeIkasTokens({
    merchantId: merchant.id,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresInSeconds: token.expires_in,
  });

  // Best-effort: register webhooks + queue the initial KB sync.
  try {
    await registerIkasWebhooks(token.access_token);
    await enqueue({ name: "ikas.sync-products", payload: { merchantId: merchant.id } });
  } catch (err) {
    console.error("[ikas:callback] post-connect setup failed", err);
  }

  session.merchantId = merchant.id;
  session.storeId = storeId;
  session.oauthState = undefined;
  await session.save();

  return NextResponse.redirect(`${env.deployUrl}/dashboard`);
}
