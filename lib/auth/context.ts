import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { getCurrentMerchantId } from "@/lib/auth/session";
import { readBearerToken, verifyIkasSessionToken } from "@/lib/auth/ikas-jwt";

/**
 * Resolve the active tenant for a request, supporting both run modes:
 *
 *   embedded   — running in an iframe inside the ikas admin panel. The client
 *                sends an App Bridge JWT as a Bearer token; cookies are not
 *                reliable cross-site.
 *   standalone — running on our own domain. The encrypted iron-session cookie
 *                set by the OAuth callback carries the tenant.
 *
 * Bearer wins when present, cookie otherwise. As always: the tenant is derived
 * from verified credentials, NEVER from a client-supplied merchantId field.
 */

export type TenantSource = "ikas-session-token" | "cookie" | null;

export interface TenantContext {
  /** Our internal Merchant.id — the FK every tenant-scoped row uses. */
  merchantId: string | null;
  source: TenantSource;
}

export async function resolveTenant(req: Request): Promise<TenantContext> {
  const bearer = readBearerToken(req);

  if (bearer) {
    const claims = await verifyIkasSessionToken(bearer);
    if (claims) {
      // The JWT carries ikas' store id, which is our Merchant.externalStoreId —
      // not our own primary key. Map it, don't conflate them.
      const merchant = isConfigured.database()
        ? await prisma.merchant.findUnique({
            where: {
              platform_externalStoreId: {
                platform: "IKAS",
                externalStoreId: claims.merchantId,
              },
            },
            select: { id: true },
          })
        : null;

      if (merchant) return { merchantId: merchant.id, source: "ikas-session-token" };

      // Valid token but no Merchant row: the app is installed in ikas but has
      // never completed OAuth here. The client should call reAuthorizeApp().
      return { merchantId: null, source: "ikas-session-token" };
    }
  }

  const cookieMerchantId = await getCurrentMerchantId();
  return {
    merchantId: cookieMerchantId,
    source: cookieMerchantId ? "cookie" : null,
  };
}

/** Convenience for routes that only need the id. */
export async function requireMerchantId(req: Request): Promise<string | null> {
  return (await resolveTenant(req)).merchantId;
}
