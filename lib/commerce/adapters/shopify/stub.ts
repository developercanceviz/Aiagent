import {
  NotImplementedError,
  type CommerceAdapter,
  type CustomerStats,
  type DateRange,
  type NormalizedOrder,
  type NormalizedProduct,
  type OrderOwnershipVerifier,
  type OrderStatus,
  type Paginated,
  type SalesSummary,
} from "@/lib/commerce/types";

/**
 * Shopify adapter stub. Proves the adapter pattern holds for a second platform.
 * Fleshed out in Phase 10. Every method throws NotImplemented so misuse is loud.
 */
export class ShopifyAdapter implements CommerceAdapter {
  readonly platform = "SHOPIFY" as const;

  getOrders(_a: { since?: Date; status?: OrderStatus; limit?: number; cursor?: string }): Promise<Paginated<NormalizedOrder>> {
    throw new NotImplementedError("Shopify", "getOrders");
  }
  getOrderByNumber(_n: string, _v: OrderOwnershipVerifier): Promise<NormalizedOrder | null> {
    throw new NotImplementedError("Shopify", "getOrderByNumber");
  }
  searchProducts(_q: string): Promise<NormalizedProduct[]> {
    throw new NotImplementedError("Shopify", "searchProducts");
  }
  getProduct(_id: string): Promise<NormalizedProduct | null> {
    throw new NotImplementedError("Shopify", "getProduct");
  }
  listProducts(_a: { cursor?: string; limit?: number }): Promise<Paginated<NormalizedProduct>> {
    throw new NotImplementedError("Shopify", "listProducts");
  }
  getProductStock(_v: string): Promise<number> {
    throw new NotImplementedError("Shopify", "getProductStock");
  }
  getCustomers(_a: { cursor?: string; limit?: number }): Promise<Paginated<{ id: string; orderCount: number }>> {
    throw new NotImplementedError("Shopify", "getCustomers");
  }
  getCustomerStats(): Promise<CustomerStats> {
    throw new NotImplementedError("Shopify", "getCustomerStats");
  }
  getSalesSummary(_a: { range: DateRange }): Promise<SalesSummary> {
    throw new NotImplementedError("Shopify", "getSalesSummary");
  }
}
