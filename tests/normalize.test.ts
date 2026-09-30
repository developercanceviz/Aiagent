import { describe, expect, it } from "vitest";

import {
  normalizeOrder,
  normalizeOrderStatus,
  normalizeProduct,
} from "@/lib/commerce/adapters/ikas/normalize";

describe("ikas normalizers", () => {
  it("maps ikas order statuses onto the normalized union", () => {
    expect(normalizeOrderStatus("PACKAGE_SHIPPED")).toBe("SHIPPED");
    expect(normalizeOrderStatus("PAYMENT_COMPLETED")).toBe("PAID");
    expect(normalizeOrderStatus("CANCELED")).toBe("CANCELLED");
    expect(normalizeOrderStatus("something-weird")).toBe("UNKNOWN");
  });

  it("normalizes an order with line items", () => {
    const o = normalizeOrder({
      id: "o1",
      orderNumber: "1001",
      status: "PACKAGE_DELIVERED",
      totalFinalPrice: 250,
      currencyCode: "TRY",
      createdAt: "2026-06-01T00:00:00.000Z",
      customer: { id: "c1", email: "a@b.com" },
      // Live schema: city is OrderAddressCity { name }, an object.
      billingAddress: { city: { name: "İstanbul" } },
      orderLineItems: [
        { quantity: 2, finalPrice: 100, variant: { id: "v1", productId: "p1", name: "5 kg Hurma" } },
      ],
    });
    expect(o.status).toBe("DELIVERED");
    expect(o.total.amount).toBe(250);
    expect(o.city).toBe("İstanbul");
    expect(o.items[0]?.quantity).toBe(2);
    expect(o.tracking).toBeUndefined();
  });

  it("normalizes tracking info from the latest order package", () => {
    // Real shape confirmed live: DHL eCommerce order CCH44524.
    const o = normalizeOrder({
      id: "o2",
      orderNumber: "CCH44524",
      status: "CREATED",
      orderPackages: [
        {
          orderPackageFulfillStatus: "DELIVERED",
          trackingInfo: {
            trackingNumber: "368674663441",
            trackingLink: "https://kargotakip.dhlecommerce.com.tr/?takipNo=368674663441",
            cargoCompany: "DHL eCommerce",
          },
        },
      ],
    });
    expect(o.tracking).toEqual({
      number: "368674663441",
      link: "https://kargotakip.dhlecommerce.com.tr/?takipNo=368674663441",
      carrier: "DHL eCommerce",
      status: "Teslim edildi",
    });
  });

  it("still returns a status when no tracking number is assigned yet", () => {
    // A freshly-created package (PLANNED) has no carrier/number yet — the
    // customer should still hear "being prepared", not silence.
    const o = normalizeOrder({
      id: "o3",
      orderNumber: "CCH99999",
      orderPackages: [{ orderPackageFulfillStatus: "PLANNED", trackingInfo: null }],
    });
    expect(o.tracking).toEqual({
      number: undefined,
      link: undefined,
      carrier: undefined,
      status: "Hazırlanıyor",
    });
  });

  it("normalizes a product with variants and sorted images", () => {
    // Live schema: stock is a per-location list on the variant; images live on
    // variants, main image first.
    const p = normalizeProduct({
      id: "p1",
      name: "Jumbo Hurma",
      totalStock: 12,
      variants: [
        {
          id: "v1",
          sku: "JH-5",
          stocks: [{ stockCount: 7 }, { stockCount: 5 }],
          prices: [{ sellPrice: 199, currency: "TRY" }],
          images: [
            { imageId: "b", isMain: false, order: 2 },
            { imageId: "a", isMain: true, order: 5 },
          ],
        },
      ],
    });
    expect(p.price.amount).toBe(199);
    expect(p.stock).toBe(12);
    expect(p.variants[0]?.stock).toBe(12); // summed across locations
    expect(p.images).toEqual(["a", "b"]); // isMain wins over order
  });

  it("prefers the active campaign price over the list price", () => {
    // Production incident: "İran Hurması 12'li Koli" was quoted at ₺1.500
    // (sellPrice) while the storefront — and the customer — showed ₺1.250
    // (discountPrice, 17% off). Only sellPrice was read before this.
    const p = normalizeProduct({
      id: "p1",
      name: "İran Hurması 12'li Koli",
      totalStock: 179,
      variants: [
        {
          id: "v1",
          sku: "IH-12",
          stocks: [{ stockCount: 179 }],
          prices: [{ sellPrice: 1500, discountPrice: 1250, currency: "TRY" }],
        },
      ],
    });
    expect(p.price.amount).toBe(1250);
    expect(p.compareAtPrice?.amount).toBe(1500);
    expect(p.variants[0]?.price.amount).toBe(1250);
    expect(p.variants[0]?.compareAtPrice?.amount).toBe(1500);
  });

  it("ignores discountPrice when it isn't actually a discount", () => {
    const noDiscount = normalizeProduct({
      id: "p2",
      name: "No Campaign",
      variants: [{ id: "v1", prices: [{ sellPrice: 500, discountPrice: 0 }] }],
    });
    expect(noDiscount.price.amount).toBe(500);
    expect(noDiscount.compareAtPrice).toBeUndefined();

    // discountPrice >= sellPrice should never happen, but must not be treated
    // as a discount if it does (e.g. stale/inconsistent data upstream).
    const badData = normalizeProduct({
      id: "p3",
      name: "Bad Data",
      variants: [{ id: "v1", prices: [{ sellPrice: 500, discountPrice: 600 }] }],
    });
    expect(badData.price.amount).toBe(500);
    expect(badData.compareAtPrice).toBeUndefined();
  });
});
