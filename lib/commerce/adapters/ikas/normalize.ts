import type {
  NormalizedMoney,
  NormalizedOrder,
  NormalizedProduct,
  NormalizedTracking,
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
  orderPackages?: Array<{
    orderPackageFulfillStatus?: string;
    trackingInfo?: {
      trackingNumber?: string | null;
      trackingLink?: string | null;
      cargoCompany?: string | null;
    } | null;
  }>;
}

/** ikas's OrderPackageFulfillStatusEnum, in plain Turkish for the agent to
 *  read straight out — verified live against real shipped/returned orders. */
function packageStatusLabel(status: string | undefined): string {
  switch (status) {
    case "PLANNED":
      return "Hazırlanıyor";
    case "WAITING_FOR_PACKAGING":
      return "Paketleniyor";
    case "READY_FOR_SHIPMENT":
      return "Kargoya verilmeye hazır";
    case "READY_FOR_PICK_UP":
      return "Şubeden teslim almaya hazır";
    case "FULFILLED":
      return "Kargoya verildi";
    case "DELIVERED":
      return "Teslim edildi";
    case "UNABLE_TO_DELIVER":
      return "Teslim edilemedi";
    case "CANCELLED":
      return "İptal edildi";
    case "CANCEL_REQUESTED":
      return "İptal talebi alındı";
    case "CANCEL_REJECTED":
      return "İptal talebi reddedildi";
    case "REFUNDED":
      return "İade edildi";
    case "REFUND_REQUESTED":
      return "İade talebi alındı";
    case "REFUND_REQUEST_ACCEPTED":
      return "İade talebi onaylandı";
    case "REFUND_REJECTED":
      return "İade talebi reddedildi";
    case "RETURN_PARCEL_WAITING":
      return "İade kargosu bekleniyor";
    case "RETURN_IN_TRANSIT":
      return "İade kargoda";
    case "RETURN_DELIVERED":
      return "İade kargosu teslim edildi";
    case "RETURN_REJECTED":
      return "İade reddedildi";
    case "ERROR":
      return "Kargo işleminde hata oluştu";
    default:
      return "Durum bilgisi yok";
  }
}

/** The most recent package on the order — ikas returns them in creation
 *  order and a single-package order is by far the common case; for a
 *  partially-split shipment this surfaces the latest leg rather than every
 *  one, which is enough for "where's my order" without overcomplicating the
 *  tool's response. */
function normalizeTracking(o: RawOrder): NormalizedTracking | undefined {
  const pkg = (o.orderPackages ?? []).at(-1);
  if (!pkg) return undefined;
  return {
    // Unset while still PLANNED/being packed — the status alone is still
    // worth returning rather than treating "no package yet" as "no order".
    number: pkg.trackingInfo?.trackingNumber ?? undefined,
    link: pkg.trackingInfo?.trackingLink ?? undefined,
    carrier: pkg.trackingInfo?.cargoCompany ?? undefined,
    status: packageStatusLabel(pkg.orderPackageFulfillStatus),
  };
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
    tracking: normalizeTracking(o),
  };
}

// Live schema (2026-07-27): variant stock is a per-location list, images live
// on variants (Product itself has no images/url fields).
interface RawVariant {
  id: string;
  sku?: string;
  stocks?: Array<{ stockCount?: number }>;
  prices?: Array<{
    sellPrice?: number;
    discountPrice?: number | null;
    currency?: string | null;
    currencyCode?: string | null;
  }>;
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

type RawPriceEntry = NonNullable<RawVariant["prices"]>[number];

/**
 * ikas exposes both a list price (`sellPrice`) and an optional active-campaign
 * price (`discountPrice`) per variant. The storefront shows `discountPrice`
 * whenever it's set and lower than `sellPrice` — that's what a customer
 * actually pays. Before this, only `sellPrice` was read, so any product on a
 * live campaign was quoted at its pre-discount price (confirmed live:
 * "İran Hurması 12'li Koli" — quoted ₺1.500, storefront shows ₺1.250, 17% off).
 */
function effectivePrice(entry?: RawPriceEntry): number {
  const sell = entry?.sellPrice ?? 0;
  const discount = entry?.discountPrice;
  return discount != null && discount > 0 && discount < sell ? discount : sell;
}

function compareAtPrice(
  entry: RawPriceEntry | undefined,
  currency: string
): NormalizedMoney | undefined {
  const sell = entry?.sellPrice ?? 0;
  const discount = entry?.discountPrice;
  if (discount == null || discount <= 0 || discount >= sell) return undefined;
  return { amount: sell, currency };
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
    price: { amount: effectivePrice(firstPrice), currency },
    compareAtPrice: compareAtPrice(firstPrice, currency),
    stock: p.totalStock ?? 0,
    variants: (p.variants ?? []).map((v) => {
      const vPrice = v.prices?.[0];
      const vCurrency = vPrice?.currencyCode ?? vPrice?.currency ?? currency;
      return {
        id: v.id,
        title: v.sku ?? v.id,
        price: { amount: effectivePrice(vPrice), currency: vCurrency },
        compareAtPrice: compareAtPrice(vPrice, vCurrency),
        stock: variantStock(v),
      };
    }),
    images: (p.variants ?? [])
      .flatMap((v) => v.images ?? [])
      .sort((a, b) => Number(b.isMain ?? false) - Number(a.isMain ?? false) || (a.order ?? 0) - (b.order ?? 0))
      .map((i) => i.imageId ?? "")
      .filter(Boolean),
    url: undefined,
  };
}

export type { RawOrder, RawProduct };
