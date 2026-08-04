import { NextRequest, NextResponse } from "next/server";

import { env, isConfigured } from "@/lib/config/env";
import { exchangeCodeForToken, readStoreIdFromToken } from "@/lib/auth/ikas-oauth";
import { storeIkasTokens } from "@/lib/auth/ikas-token";
import { GET_MERCHANT, ikasGraphQL } from "@/lib/commerce/adapters/ikas/graphql";
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

  const session = await getSession();
  if (!code || !state || state !== session.oauthState) {
    return NextResponse.json({ error: "Invalid OAuth state" }, { status: 400 });
  }

  const redirectUri = `${env.deployUrl}/api/auth/ikas/callback`;
  const token = await exchangeCodeForToken({ code, redirectUri });

  // ikas does NOT identify the store in callback params (only code/state/
  // signature) — the token itself is the source of truth. Ask the API who it
  // belongs to; fall back to the token's JWT claims, then to legacy params.
  let storeId = "";
  let storeName = params.get("storeName") ?? "Mağaza";
  try {
    const data = await ikasGraphQL<{
      getMerchant: { id: string; storeName: string | null } | null;
    }>({ accessToken: token.access_token, query: GET_MERCHANT });
    storeId = data.getMerchant?.id ?? "";
    storeName = data.getMerchant?.storeName ?? storeName;
  } catch (err) {
    console.error("[ikas:callback] getMerchant failed, using token claims", err);
  }
  storeId ||=
    readStoreIdFromToken(token.access_token) ??
    params.get("merchantId") ??
    params.get("storeId") ??
    "";
  if (!storeId) {
    return NextResponse.json(
      { error: "Could not determine the store this authorization belongs to." },
      { status: 502 }
    );
  }

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
