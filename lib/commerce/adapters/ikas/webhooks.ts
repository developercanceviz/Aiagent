import { ikasGraphQL, SAVE_WEBHOOK } from "@/lib/commerce/adapters/ikas/graphql";
import { env } from "@/lib/config/env";

/** ikas webhook scopes we subscribe to on connect. */
export const IKAS_WEBHOOK_SCOPES = [
  "store/order/created",
  "store/order/updated",
  "store/customer/created",
  "store/product/updated",
] as const;

/**
 * Register our webhook endpoint for all scopes we care about. Idempotent on the
 * ikas side (re-saving the same scope+endpoint updates it).
 */
export async function registerIkasWebhooks(accessToken: string): Promise<void> {
  const endpoint = `${env.deployUrl}/api/webhooks/ikas`;
  for (const scope of IKAS_WEBHOOK_SCOPES) {
    await ikasGraphQL({
      accessToken,
      query: SAVE_WEBHOOK,
      variables: { input: { scope, endpoint } },
    });
  }
}
