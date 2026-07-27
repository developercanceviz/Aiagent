import type { Merchant } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { decryptSecret, encryptSecret } from "@/lib/crypto/secrets";
import { refreshAccessToken } from "@/lib/auth/ikas-oauth";

/** Refresh the access token a few minutes before it expires. */
const REFRESH_SKEW_MS = 5 * 60 * 1000;

/**
 * Returns a Merchant whose (encrypted) accessToken is valid. If it's expired or
 * near-expiry and a refresh token exists, rotate it, persist the encrypted
 * values, and return the updated record. Tokens are never logged.
 */
export async function refreshIkasTokenIfNeeded(
  merchant: Merchant
): Promise<Merchant> {
  const expiresAt = merchant.tokenExpiresAt?.getTime() ?? 0;
  const needsRefresh = expiresAt - Date.now() < REFRESH_SKEW_MS;

  if (!needsRefresh || !merchant.refreshToken) {
    return merchant;
  }

  const refreshToken = decryptSecret(merchant.refreshToken);
  const next = await refreshAccessToken(refreshToken);

  return prisma.merchant.update({
    where: { id: merchant.id },
    data: {
      accessToken: encryptSecret(next.access_token),
      refreshToken: next.refresh_token
        ? encryptSecret(next.refresh_token)
        : merchant.refreshToken,
      tokenExpiresAt: new Date(Date.now() + next.expires_in * 1000),
    },
  });
}

/** Persist a freshly-issued token set on a merchant (post-OAuth). */
export async function storeIkasTokens(args: {
  merchantId: string;
  accessToken: string;
  refreshToken?: string;
  expiresInSeconds: number;
}): Promise<void> {
  await prisma.merchant.update({
    where: { id: args.merchantId },
    data: {
      accessToken: encryptSecret(args.accessToken),
      refreshToken: args.refreshToken ? encryptSecret(args.refreshToken) : null,
      tokenExpiresAt: new Date(Date.now() + args.expiresInSeconds * 1000),
    },
  });
}
