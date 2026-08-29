import { tool } from "ai";
import { z } from "zod";

import type { CommerceAdapter } from "@/lib/commerce/types";
import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { retrieve } from "@/lib/ai/rag";
import { formatTRY } from "@/lib/utils";

export interface CustomerToolContext {
  merchantId: string;
  conversationId: string;
  /**
   * null when the store connection is momentarily unavailable (expired ikas
   * token, provider outage). The commerce tools are then simply not offered,
   * so the agent still answers from the knowledge base instead of the whole
   * turn failing.
   */
  adapter: CommerceAdapter | null;
}

/**
 * Customer-agent tools. All commerce reads are tenant-scoped & read-only.
 * getOrderStatus REQUIRES ownership proof (email/phone) and never reveals
 * another customer's data. escalateToHuman / captureLead write only to our
 * own tables.
 */
export function buildCustomerTools(ctx: CustomerToolContext) {
  // Commerce tools need a live store connection. Without one the agent keeps
  // its knowledge-base, escalation and lead tools and answers what it can,
  // rather than the whole turn dying on an ikas hiccup.
  const commerceTools = ctx.adapter
    ? buildCommerceTools({ ...ctx, adapter: ctx.adapter })
    : {};

  return {
    ...commerceTools,
    searchKnowledge: tool({
      description: "SSS, politikalar ve ürün bilgisi içeren bilgi bankasında arama yapar.",
      parameters: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const chunks = await retrieve(ctx.merchantId, query, { limit: 4 });
        return chunks.map((c) => ({ title: c.title, content: c.content }));
      },
    }),

    escalateToHuman: tool({
      description:
        "Konuşmayı bir müşteri temsilcisine aktarır. Yanıtlayamadığında veya müşteri insan istediğinde kullan.",
      parameters: z.object({ reason: z.string().min(1) }),
      execute: async ({ reason }) => {
        if (isConfigured.database()) {
          await prisma.conversation.update({
            where: { id: ctx.conversationId },
            data: { status: "NEEDS_HUMAN", handledBy: "HUMAN" },
          });
        }
        return { escalated: true, reason };
      },
    }),

    captureLead: tool({
      description:
        "Müşteri iletişim/ilgi bilgisi verdiğinde CRM'e yeni lead ekler. " +
        "Müşteri iade veya değişim talebinden söz ederse category='iade' gönder.",
      parameters: z.object({
        name: z.string().min(1),
        contact: z.string().nullable().describe("Telefon/e-posta; yoksa null"),
        intent: z.string().nullable().describe("İlgi/istek özeti; yoksa null"),
        category: z
          .enum(["iade", "genel"])
          .nullable()
          .describe("İade/değişim talebi ise 'iade', aksi halde 'genel'"),
      }),
      execute: async ({ name, contact, intent, category }) => {
        // The model only classifies; the column mapping is decided here so a
        // hallucinated stage name can never reach the database.
        const stage = category === "iade" ? "IADE_TALEP" : "YENI";
        if (isConfigured.database()) {
          await prisma.lead.upsert({
            where: { conversationId: ctx.conversationId },
            update: { name, contact, note: intent, stage },
            create: {
              merchantId: ctx.merchantId,
              conversationId: ctx.conversationId,
              name,
              contact,
              note: intent,
              stage,
            },
          });
        }
        return { captured: true };
      },
    }),
  };
}

/** Read-only store data — only offered when the adapter could be built. */
function buildCommerceTools(
  ctx: CustomerToolContext & { adapter: CommerceAdapter }
) {
  return {
    searchProducts: tool({
      description: "Mağaza ürünlerinde arama yapar; isim, fiyat ve stok döndürür.",
      parameters: z.object({ query: z.string().min(1) }),
      execute: async ({ query }) => {
        const products = await ctx.adapter.searchProducts(query);
        return products.slice(0, 5).map((p) => ({
          id: p.id,
          name: p.name,
          price: formatTRY(p.price.amount),
          stock: p.stock,
          url: p.url,
        }));
      },
    }),

    getProductStock: tool({
      description: "Belirli bir varyantın stok adedini döndürür.",
      parameters: z.object({ variantId: z.string().min(1) }),
      execute: async ({ variantId }) => ({
        variantId,
        stock: await ctx.adapter.getProductStock(variantId),
      }),
    }),

    getOrderStatus: tool({
      description:
        "Sipariş durumunu döndürür. SADECE müşteri kendi sipariş numarasını ve eşleşen e-posta VEYA telefon bilgisini verirse çalışır. Eşleşme yoksa sipariş bilgisi paylaşma.",
      // Nullable (not optional): OpenAI strict mode requires every property
      // to be listed in `required`.
      parameters: z.object({
        orderNumber: z.string().min(1),
        email: z.string().email().nullable().describe("Müşterinin verdiği e-posta; yoksa null"),
        phone: z.string().min(7).nullable().describe("Müşterinin verdiği telefon; yoksa null"),
      }),
      execute: async ({ orderNumber, email, phone }) => {
        if (!email && !phone) {
          return { verified: false, reason: "E-posta veya telefon gerekli." };
        }
        const order = await ctx.adapter.getOrderByNumber(orderNumber, {
          email: email ?? undefined,
          phone: phone ?? undefined,
        });
        if (!order) {
          return { verified: false, reason: "Doğrulama başarısız veya sipariş bulunamadı." };
        }
        return {
          verified: true,
          number: order.number,
          status: order.status,
          total: formatTRY(order.total.amount),
          createdAt: order.createdAt,
        };
      },
    }),
  };
}
