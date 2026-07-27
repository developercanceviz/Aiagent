import { isConfigured } from "@/lib/config/env";

/**
 * Reacts to store/order/created|updated: refresh analytics caches and trigger
 * order-related automations (e.g. abandoned-cart follow-ups). Analytics are
 * computed on-read from the adapter, so for now this is a hook point + audit
 * log. Extend in Phase 3/10 as caching is added.
 */
export async function handleOrderChanged(payload: {
  merchantId: string;
  orderId?: string;
}): Promise<void> {
  if (!isConfigured.database()) return;
  // Placeholder for analytics cache invalidation / automation triggers.
  console.info(
    `[job] order-changed merchant=${payload.merchantId} order=${payload.orderId ?? "?"}`
  );
}
