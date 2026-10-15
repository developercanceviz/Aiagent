import { NextRequest, NextResponse } from "next/server";

import { env, isConfigured } from "@/lib/config/env";
import { buildInstagramAuthorizeUrl, signInstagramOAuthState } from "@/lib/auth/instagram-oauth";
import { getCurrentMerchantId } from "@/lib/auth/session";

/**
 * Returns the Instagram authorize URL as JSON rather than redirecting —
 * this must be called via same-origin fetch() from WITHIN the ikas admin
 * iframe (where the session cookie is actually readable) so the merchant's
 * identity can be signed into `state` before the browser ever leaves for
 * Instagram's consent screen in a new tab. See the client in
 * app/(dashboard)/ayarlar/kanallar/page.tsx and the comment on
 * signInstagramOAuthState for why a plain redirect link can't work here.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured.instagramOAuth()) {
    return NextResponse.json(
      { error: "Instagram OAuth is not configured. Set INSTAGRAM_APP_ID + INSTAGRAM_APP_SECRET (or META_APP_ID + META_APP_SECRET)." },
      { status: 503 }
    );
  }

  const merchantId = await getCurrentMerchantId();
  if (!merchantId) {
    return NextResponse.json({ error: "No store in session." }, { status: 401 });
  }

  const redirectUri = `${env.deployUrl}/api/auth/instagram/callback`;
  const url = buildInstagramAuthorizeUrl({
    state: signInstagramOAuthState(merchantId),
    redirectUri,
  });
  return NextResponse.json({ url });
}
