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
  createdAt?: string;
  customer?: { id?: string; email?: string; phone?: string } | null;
  billingAddress?: { city?: string } | null;
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
    city: o.billingAddress?.city ?? undefined,
    createdAt: o.createdAt ?? new Date().toISOString(),
  };
}

interface RawProduct {
  id: string;
  name: string;
  description?: string;
  totalStock?: number;
  variants?: Array<{
    id: string;
    sku?: string;
    stockCount?: number;
    prices?: Array<{ sellPrice?: number; currency?: string }>;
  }>;
  images?: Array<{ imageId?: string; order?: number }>;
  url?: string;
}

export function normalizeProduct(p: RawProduct): NormalizedProduct {
  const firstVariant = p.variants?.[0];
  const firstPrice = firstVariant?.prices?.[0];
  const currency = firstPrice?.currency ?? "TRY";
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
        currency: v.prices?.[0]?.currency ?? currency,
      },
      stock: v.stockCount ?? 0,
    })),
    images: (p.images ?? [])
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      .map((i) => i.imageId ?? "")
      .filter(Boolean),
    url: p.url,
  };
}

export type { RawOrder, RawProduct };
