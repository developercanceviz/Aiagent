import { prisma } from "@/lib/db/client";
import { decryptSecret } from "@/lib/crypto/secrets";
import { getCommerceAdapter } from "@/lib/commerce/registry";
import type { CommerceAdapter } from "@/lib/commerce/types";
import { refreshIkasTokenIfNeeded } from "@/lib/auth/ikas-token";

export async function getMerchant(merchantId: string) {
  return prisma.merchant.findUnique({ where: { id: merchantId } });
}

export async function getMerchantByExternalId(
  platform: "IKAS" | "SHOPIFY" | "GENERIC",
  externalStoreId: string
) {
  return prisma.merchant.findUnique({
    where: { platform_externalStoreId: { platform, externalStoreId } },
  });
}

/**
 * Resolve a ready-to-use, tenant-scoped CommerceAdapter for a merchant:
 * load the merchant, refresh the ikas token if it's near expiry, decrypt it,
 * and hand it to the platform's adapter. Throws if the merchant is unknown.
 */
export async function getMerchantAdapter(
  merchantId: string
): Promise<CommerceAdapter> {
  const merchant = await getMerchant(merchantId);
  if (!merchant) throw new Error(`Merchant ${merchantId} not found`);

  const fresh = await refreshIkasTokenIfNeeded(merchant);
  const accessToken = decryptSecret(fresh.accessToken);

  return getCommerceAdapter(merchant.platform, {
    accessToken,
    storeId: merchant.externalStoreId,
  });
}
