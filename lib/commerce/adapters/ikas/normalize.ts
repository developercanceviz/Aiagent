import type {
  NormalizedOrder,
  NormalizedProduct,
  OrderStatus,
} from "@/lib/commerce/types";

/** Map ikas order status strings onto our normalized union. */
export function normalizeOrderStatus(raw: string | null | undefined): OrderStatus {
  switch ((raw ?? "").toUpperCase()) {
    case "CREATED":
    case "PENDING":
    case "WAITING_PAYMENT":
      return "PENDING";
    case "PAID":
    case "PAYMENT_COMPLETED":
      return "PAID";
    case "FULFILLED":
    case "PACKAGE_PREPARED":
      return "FULFILLED";
    case "SHIPPED":
    case "PACKAGE_SHIPPED":
      return "SHIPPED";
    case "DELIVERED":
    case "PACKAGE_DELIVERED":
      return "DELIVERED";
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    case "REFUNDED":
      return "REFUNDED";
    default:
      return "UNKNOWN";
  }
}

interface RawOrder {
  id: string;
  orderNumber: string;
  status?: string;
  totalFinalPrice?: number;
  currencyCode?: string;
  /** Live API returns Timestamp as epoch millis (number), not ISO. */
  createdAt?: string | number;
  customer?: { id?: string; email?: string; phone?: string } | null;
  // Live schema: city is an object (OrderAddressCity), not a scalar.
  billingAddress?: { city?: { name?: string } | null } | null;
  orderLineItems?: Array<{
    quantity: number;
    finalPrice: number;
    variant?: { id?: string; productId?: string; name?: string } | null;
  }>;
}

export function normalizeOrder(o: RawOrder): NormalizedOrder {
  const currency = o.currencyCode ?? "TRY";
  return {
    id: o.id,
    number: o.orderNumber,
    status: normalizeOrderStatus(o.status),
    total: { amount: o.totalFinalPrice ?? 0, currency },
    items: (o.orderLineItems ?? []).map((li) => ({
      productId: li.variant?.productId ?? "",
      variantId: li.variant?.id,
      name: li.variant?.name ?? "",
      quantity: li.quantity,
      unitPrice: { amount: li.finalPrice, currency },
    })),
    customerRef: o.customer?.id,
    city: o.billingAddress?.city?.name ?? undefined,
    createdAt:
      o.createdAt != null
        ? new Date(o.createdAt).toISOString()
        : new Date().toISOString(),
  };
}

// Live schema (2026-07-27): variant stock is a per-location list, images live
// on variants (Product itself has no images/url fields).
interface RawVariant {
  id: string;
  sku?: string;
  stocks?: Array<{ stockCount?: number }>;
  prices?: Array<{ sellPrice?: number; currency?: string | null; currencyCode?: string | null }>;
  images?: Array<{ imageId?: string; isMain?: boolean; order?: number }>;
}

interface RawProduct {
  id: string;
  name: string;
  description?: string;
  totalStock?: number;
  variants?: RawVariant[];
}

export function variantStock(v: RawVariant): number {
  return (v.stocks ?? []).reduce((sum, s) => sum + (s.stockCount ?? 0), 0);
}

export function normalizeProduct(p: RawProduct): NormalizedProduct {
  const firstVariant = p.variants?.[0];
  const firstPrice = firstVariant?.prices?.[0];
  // Live data: `currency` is often null while `currencyCode` is populated.
  const currency = firstPrice?.currencyCode ?? firstPrice?.currency ?? "TRY";
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? undefined,
    price: { amount: firstPrice?.sellPrice ?? 0, currency },
    stock: p.totalStock ?? 0,
    variants: (p.variants ?? []).map((v) => ({
      id: v.id,
      title: v.sku ?? v.id,
      price: {
        amount: v.prices?.[0]?.sellPrice ?? 0,
        currency: v.prices?.[0]?.currencyCode ?? v.prices?.[0]?.currency ?? currency,
      },
      stock: variantStock(v),
    })),
    images: (p.variants ?? [])
      .flatMap((v) => v.images ?? [])
      .sort((a, b) => Number(b.isMain ?? false) - Number(a.isMain ?? false) || (a.order ?? 0) - (b.order ?? 0))
      .map((i) => i.imageId ?? "")
      .filter(Boolean),
    url: undefined,
  };
}

export type { RawOrder, RawProduct };
