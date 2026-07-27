/**
 * Commerce-platform-agnostic adapter contract. The AI tools, analytics, and
 * dashboard call ONLY this interface — never ikas (or Shopify) directly. ikas
 * is the first fully-implemented adapter (lib/commerce/adapters/ikas); Shopify
 * and Generic are stubs that throw NotImplemented until their phases.
 *
 * Commerce data is READ-ONLY by default (principle §2.4). No adapter method
 * mutates orders/products/prices.
 */

export type Currency = string; // ISO 4217, e.g. "TRY"

export interface NormalizedMoney {
  amount: number;
  currency: Currency;
}

export interface NormalizedOrderItem {
  productId: string;
  variantId?: string;
  name: string;
  quantity: number;
  unitPrice: NormalizedMoney;
}

export type OrderStatus =
  | "PENDING"
  | "PAID"
  | "FULFILLED"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELLED"
  | "REFUNDED"
  | "UNKNOWN";

export interface NormalizedOrder {
  id: string;
  number: string;
  status: OrderStatus;
  total: NormalizedMoney;
  items: NormalizedOrderItem[];
  customerRef?: string;
  city?: string;
  createdAt: string; // ISO
}

export interface NormalizedVariant {
  id: string;
  title: string;
  price: NormalizedMoney;
  stock: number;
}

export interface NormalizedProduct {
  id: string;
  name: string;
  description?: string;
  price: NormalizedMoney;
  stock: number;
  variants: NormalizedVariant[];
  images: string[];
  url?: string;
}

export interface CustomerStats {
  total: number;
  new: number;
  returning: number;
}

export interface DayPoint {
  date: string; // ISO date
  revenue: number;
  orders: number;
}

export interface SalesSummary {
  range: { from: string; to: string };
  revenue: NormalizedMoney;
  orderCount: number;
  averageOrderValue: NormalizedMoney;
  byDay: DayPoint[];
  byChannel: { channel: string; orders: number; revenue: number }[];
  topProducts: { productId: string; name: string; units: number; revenue: number }[];
  topCities: { city: string; orders: number }[];
}

export interface Paginated<T> {
  data: T[];
  cursor?: string;
  hasNextPage: boolean;
}

export interface DateRange {
  from?: Date;
  to?: Date;
}

/** Verifier a customer must supply to look up their own order (no cross-customer leakage). */
export interface OrderOwnershipVerifier {
  email?: string;
  phone?: string;
}

export interface CommerceAdapter {
  readonly platform: "IKAS" | "SHOPIFY" | "GENERIC";

  getOrders(args: {
    since?: Date;
    status?: OrderStatus;
    limit?: number;
    cursor?: string;
  }): Promise<Paginated<NormalizedOrder>>;

  /** Returns the order ONLY if the verifier proves ownership; otherwise null. */
  getOrderByNumber(
    orderNumber: string,
    verifier: OrderOwnershipVerifier
  ): Promise<NormalizedOrder | null>;

  searchProducts(query: string): Promise<NormalizedProduct[]>;
  getProduct(id: string): Promise<NormalizedProduct | null>;
  listProducts(args: { cursor?: string; limit?: number }): Promise<Paginated<NormalizedProduct>>;
  getProductStock(variantId: string): Promise<number>;

  getCustomers(args: { cursor?: string; limit?: number }): Promise<Paginated<{ id: string; orderCount: number }>>;
  getCustomerStats(): Promise<CustomerStats>;

  getSalesSummary(args: { range: DateRange }): Promise<SalesSummary>;
}

export class NotImplementedError extends Error {
  constructor(platform: string, method: string) {
    super(`${platform} adapter: ${method}() is not implemented yet.`);
    this.name = "NotImplementedError";
  }
}
