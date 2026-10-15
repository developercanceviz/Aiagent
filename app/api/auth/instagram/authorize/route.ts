import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { env, isConfigured } from "@/lib/config/env";
import { buildInstagramAuthorizeUrl } from "@/lib/auth/instagram-oauth";
import { getSession } from "@/lib/auth/session";

/**
 * Kick off the Instagram OAuth connect flow for the already-logged-in
 * merchant (unlike ikas's /authorize, this never creates a Merchant — it
 * only attaches/replaces that merchant's INSTAGRAM Channel). Call from
 * Ayarlar → Kanallar's "Instagram'a Bağlan" button.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured.instagramOAuth()) {
    return NextResponse.json(
      { error: "Instagram OAuth is not configured. Set INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET (or META_APP_ID + META_APP_SECRET)." },
      { status: 503 }
    );
  }

  const session = await getSession();
  if (!session.merchantId) {
    return NextResponse.json({ error: "No store in session." }, { status: 401 });
  }

  const state = randomBytes(16).toString("hex");
  session.instagramOauthState = state;
  await session.save();

  const redirectUri = `${env.deployUrl}/api/auth/instagram/callback`;
  const url = buildInstagramAuthorizeUrl({ state, redirectUri });
  return NextResponse.redirect(url);
}
