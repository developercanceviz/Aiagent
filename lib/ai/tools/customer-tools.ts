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
  adapter: CommerceAdapter;
}

/**
 * Customer-agent tools. All commerce reads are tenant-scoped & read-only.
 * getOrderStatus REQUIRES ownership proof (email/phone) and never reveals
 * another customer's data. escalateToHuman / captureLead write only to our
 * own tables.
 */
export function buildCustomerTools(ctx: CustomerToolContext) {
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
      parameters: z.object({
        orderNumber: z.string().min(1),
        email: z.string().email().optional(),
        phone: z.string().min(7).optional(),
      }),
      execute: async ({ orderNumber, email, phone }) => {
        if (!email && !phone) {
          return { verified: false, reason: "E-posta veya telefon gerekli." };
        }
        const order = await ctx.adapter.getOrderByNumber(orderNumber, { email, phone });
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
      description: "Müşteri iletişim/ilgi bilgisi verdiğinde CRM'e yeni lead ekler.",
      parameters: z.object({
        name: z.string().min(1),
        contact: z.string().optional(),
        intent: z.string().optional(),
      }),
      execute: async ({ name, contact, intent }) => {
        if (isConfigured.database()) {
          await prisma.lead.upsert({
            where: { conversationId: ctx.conversationId },
            update: { name, contact, note: intent },
            create: {
              merchantId: ctx.merchantId,
              conversationId: ctx.conversationId,
              name,
              contact,
              note: intent,
              stage: "YENI",
            },
          });
        }
        return { captured: true };
      },
    }),
  };
}
