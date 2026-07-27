import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { isConfigured, env } from "@/lib/config/env";
import { buildAuthorizeUrl } from "@/lib/auth/ikas-oauth";
import { getSession } from "@/lib/auth/session";

/**
 * Kick off the ikas OAuth flow. /api/auth/ikas/authorize?storeName=cancevizhurma
 * Stores a CSRF `state` in the encrypted session, then redirects to ikas.
 */
export async function GET(req: NextRequest) {
  if (!isConfigured.ikas()) {
    return NextResponse.json(
      { error: "ikas is not configured. Set NEXT_PUBLIC_IKAS_CLIENT_ID + IKAS_CLIENT_SECRET." },
      { status: 503 }
    );
  }

  const storeName = req.nextUrl.searchParams.get("storeName");
  if (!storeName) {
    return NextResponse.json({ error: "storeName is required" }, { status: 400 });
  }

  const state = randomBytes(16).toString("hex");
  const session = await getSession();
  session.oauthState = state;
  await session.save();

  const redirectUri = `${env.deployUrl}/api/auth/ikas/callback`;
  const url = buildAuthorizeUrl({ storeName, state, redirectUri });
  return NextResponse.redirect(url);
}
