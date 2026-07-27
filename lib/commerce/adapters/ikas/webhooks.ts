import { ikasGraphQL, SAVE_WEBHOOKS } from "@/lib/commerce/adapters/ikas/graphql";
import { env } from "@/lib/config/env";

/** ikas webhook scopes we subscribe to on connect. */
export const IKAS_WEBHOOK_SCOPES = [
  "store/order/created",
  "store/order/updated",
  "store/customer/created",
  "store/product/updated",
] as const;

/**
 * Register our webhook endpoint for all scopes we care about. The live schema's
 * saveWebhooks takes the full scopes list in ONE call (validated 2026-07-27);
 * re-saving the same endpoint updates the registration, so this is idempotent.
 */
export async function registerIkasWebhooks(accessToken: string): Promise<void> {
  const endpoint = `${env.deployUrl}/api/webhooks/ikas`;
  await ikasGraphQL({
    accessToken,
    query: SAVE_WEBHOOKS,
    variables: { input: { endpoint, scopes: [...IKAS_WEBHOOK_SCOPES] } },
  });
}
