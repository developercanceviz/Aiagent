import { isConfigured } from "@/lib/config/env";

/**
 * Reacts to store/customer/created: enrich CRM / create a lead. Lead creation
 * from conversations is the primary path (Phase 7); this handles store-side
 * customer signups. Hook point for now.
 */
export async function handleCustomerCreated(payload: {
  merchantId: string;
  customerId?: string;
}): Promise<void> {
  if (!isConfigured.database()) return;
  console.info(
    `[job] customer-created merchant=${payload.merchantId} customer=${payload.customerId ?? "?"}`
  );
}
