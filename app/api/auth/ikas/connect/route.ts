import { NextRequest, NextResponse } from "next/server";

import { env, isConfigured } from "@/lib/config/env";
import { clientCredentialsToken } from "@/lib/auth/ikas-oauth";
import { storeIkasTokens } from "@/lib/auth/ikas-token";
import { registerIkasWebhooks } from "@/lib/commerce/adapters/ikas/webhooks";
import { getSession } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { encryptSecret } from "@/lib/crypto/secrets";
import { enqueue } from "@/lib/queue";

/**
 * Connect a store via the PRIVATE-app flow (Özel Uygulama — client
 * credentials, no browser redirect). /api/auth/ikas/connect?storeName=...
 *
 * Mirrors the OAuth callback's post-connect work: upsert Merchant with
 * encrypted tokens, register webhooks, queue the product→KB sync, bind the
 * session. The credentials come from env, never from the request.
 *
 * ⚠️ Until dashboard auth lands, this route (like the dashboard itself) is
 * unauthenticated. Guard: once ANY merchant exists, only reconnects of that
 * same store are allowed, so a stranger cannot attach a second store or
 * rebind sessions to a different tenant.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured.ikas() || !isConfigured.database()) {
    return NextResponse.json(
      { error: "ikas/DB not configured. Set NEXT_PUBLIC_IKAS_CLIENT_ID + IKAS_CLIENT_SECRET + DATABASE_URL." },
      { status: 503 }
    );
  }

  const storeName = req.nextUrl.searchParams.get("storeName");
  if (!storeName || !/^[a-z0-9-]+$/i.test(storeName)) {
    return NextResponse.json({ error: "storeName is required (e.g. ?storeName=cancevizhurma)" }, { status: 400 });
  }

  let token;
  try {
    token = await clientCredentialsToken(storeName);
  } catch (err) {
    // Surface the failure reason — this is the first-ever live call to ikas
    // auth and the endpoint shape is unvalidated. Message contains no secrets.
    return NextResponse.json(
      { error: "ikas token exchange failed", detail: err instanceof Error ? err.message : "unknown" },
      { status: 502 }
    );
  }

  // The access token is a JWT whose payload carries the store identity.
  // Received directly from ikas over TLS, so decode without verification and
  // fall back to the storeName if the expected claim isn't there.
  const externalStoreId = readStoreId(token.access_token) ?? storeName;

  const existing = await prisma.merchant.findFirst({ select: { id: true, externalStoreId: true } });
  if (existing && existing.externalStoreId !== externalStoreId) {
    return NextResponse.json(
      { error: "Another store is already connected. Multi-store onboarding requires the OAuth flow." },
      { status: 403 }
    );
  }

  const merchant = await prisma.merchant.upsert({
    where: { platform_externalStoreId: { platform: "IKAS", externalStoreId } },
    update: { storeName, storeDomain: `${storeName}.myikas.com` },
    create: {
      platform: "IKAS",
      externalStoreId,
      storeName,
      storeDomain: `${storeName}.myikas.com`,
      accessToken: encryptSecret(token.access_token),
    },
  });

  await storeIkasTokens({
    merchantId: merchant.id,
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresInSeconds: token.expires_in,
  });

  // Best-effort, same as the OAuth callback.
  try {
    await registerIkasWebhooks(token.access_token);
    await enqueue({ name: "ikas.sync-products", payload: { merchantId: merchant.id } });
  } catch (err) {
    console.error("[ikas:connect] post-connect setup failed", err);
  }

  const session = await getSession();
  session.merchantId = merchant.id;
  session.storeId = externalStoreId;
  await session.save();

  return NextResponse.redirect(`${env.deployUrl}/dev/ikas-check`);
}

/** Best-effort JWT payload decode — no verification, provenance is direct TLS. */
function readStoreId(accessToken: string): string | null {
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split(".")[1] ?? "", "base64url").toString("utf8")
    ) as Record<string, unknown>;
    for (const claim of ["merchantId", "storeId", "sub"]) {
      const v = payload[claim];
      if (typeof v === "string" && v.length > 0) return v;
    }
    return null;
  } catch {
    return null;
  }
}
