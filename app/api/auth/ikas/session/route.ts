import { NextResponse } from "next/server";

import { resolveTenant } from "@/lib/auth/context";
import { getSession } from "@/lib/auth/session";

/**
 * Embedded-mode session bootstrap.
 *
 * Server-rendered pages learn the tenant from the iron-session cookie — but
 * inside the ikas iframe that cookie doesn't exist on first load (App Bridge
 * gives the client a JWT instead, and cross-site cookies don't travel). This
 * route bridges the two: the client POSTs its App Bridge token, we verify it,
 * and set the session cookie so every subsequent server render knows the
 * tenant. The provider reloads once after a fresh bind.
 */
export async function POST(req: Request) {
  const tenant = await resolveTenant(req);

  if (tenant.source !== "ikas-session-token" || !tenant.merchantId) {
    return NextResponse.json(
      { error: "No verifiable ikas session token." },
      { status: 401 }
    );
  }

  const session = await getSession();
  const alreadyBound = session.merchantId === tenant.merchantId;
  if (!alreadyBound) {
    session.merchantId = tenant.merchantId;
    await session.save();
  }

  return NextResponse.json({ bound: alreadyBound ? "existing" : "new" });
}
