import { tool } from "ai";
import { z } from "zod";

import type { CommerceAdapter, DateRange } from "@/lib/commerce/types";

/**
 * Merchant (store assistant) tools — read-only analytics over the tenant's own
 * commerce data via the adapter. Bound to a single merchant's adapter so the
 * model can't reach another tenant. Returned objects are JSON-serializable.
 */
export function buildMerchantTools(adapter: CommerceAdapter) {
  return {
    getSalesSummary: tool({
      description:
        "Belirtilen tarih aralığı için satış özeti: ciro, sipariş sayısı, ortalama sepet, günlük seri, en çok satan ürünler ve şehirler.",
      // OpenAI strict mode requires every property in `required` — optionals
      // are expressed as nullable, with the default applied in execute.
      parameters: z.object({
        fromDaysAgo: z
          .number()
          .int()
          .min(1)
          .max(365)
          .nullable()
          .describe("Bugünden kaç gün öncesinden başlasın; bilinmiyorsa null (7 varsayılır)"),
      }),
      execute: async ({ fromDaysAgo }) => {
        const days = fromDaysAgo ?? 7;
        const range: DateRange = {
          from: new Date(Date.now() - days * 86400_000),
          to: new Date(),
        };
        return adapter.getSalesSummary({ range });
      },
    }),

    getCustomerStats: tool({
      description: "Toplam müşteri sayısı, yeni ve geri dönen müşteri kırılımı.",
      parameters: z.object({}),
      execute: async () => adapter.getCustomerStats(),
    }),

    getOrders: tool({
      description:
        "Son siparişleri listeler. status verilirse o duruma göre filtreler (ör. PENDING, SHIPPED).",
      parameters: z.object({
        limit: z.number().int().min(1).max(100).nullable().describe("Kaç sipariş; null ise 20"),
        status: z
          .enum([
            "PENDING",
            "PAID",
            "FULFILLED",
            "SHIPPED",
            "DELIVERED",
            "CANCELLED",
            "REFUNDED",
            "UNKNOWN",
          ])
          .nullable()
          .describe("Durum filtresi; filtre yoksa null"),
      }),
      execute: async ({ limit, status }) => {
        const page = await adapter.getOrders({ limit: limit ?? 20, status: status ?? undefined });
        return { orders: page.data, hasMore: page.hasNextPage };
      },
    }),

    getProductPerformance: tool({
      description:
        "Verilen gün aralığında en çok satan ürünleri (adet ve ciro) döndürür.",
      parameters: z.object({
        fromDaysAgo: z.number().int().min(1).max(365).nullable().describe("null ise 30"),
      }),
      execute: async ({ fromDaysAgo }) => {
        const days = fromDaysAgo ?? 30;
        const summary = await adapter.getSalesSummary({
          range: { from: new Date(Date.now() - days * 86400_000), to: new Date() },
        });
        return { topProducts: summary.topProducts };
      },
    }),
  };
}
