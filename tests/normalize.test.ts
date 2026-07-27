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
});
