import type { CommerceAdapter } from "@/lib/commerce/types";
import { IkasAdapter, type IkasCredentials } from "@/lib/commerce/adapters/ikas";
import { ShopifyAdapter } from "@/lib/commerce/adapters/shopify/stub";

export type Platform = "IKAS" | "SHOPIFY" | "GENERIC";

/**
 * Resolve the right commerce adapter for a tenant. Callers never `new` a
 * concrete adapter — they ask the registry, keeping ikas behind the seam.
 */
export function getCommerceAdapter(
  platform: Platform,
  creds: IkasCredentials
): CommerceAdapter {
  switch (platform) {
    case "IKAS":
      return new IkasAdapter(creds);
    case "SHOPIFY":
      return new ShopifyAdapter();
    case "GENERIC":
      throw new Error("Generic adapter not implemented (Phase 10).");
    default: {
      const _exhaustive: never = platform;
      throw new Error(`Unknown platform: ${_exhaustive}`);
    }
  }
}
