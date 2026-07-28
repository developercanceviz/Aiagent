import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { getMerchantAdapter } from "@/lib/db/merchant";
import { upsertKnowledgeItem } from "@/lib/db/knowledge";
import { embedBatch } from "@/lib/ai/rag";
import { formatTRY } from "@/lib/utils";

/**
 * Pull products from the commerce adapter and upsert them as
 * KnowledgeItem(type=PRODUCT) with embeddings, so the customer agent can answer
 * "5 kilo ne kadar?", "büyük boyu var mı?" type questions. Runs on connect and
 * on store/product/updated.
 */
export async function syncProductsToKnowledge(payload: {
  merchantId: string;
}): Promise<void> {
  if (!isConfigured.database()) return;
  const { merchantId } = payload;
  const adapter = await getMerchantAdapter(merchantId);

  let cursor: string | undefined;
  for (let i = 0; i < 50; i++) {
    const page = await adapter.listProducts({ cursor, limit: 50 });

    const items = page.data.map((p) => {
      const variantLines = p.variants
        .map((v) => `${v.title}: ${formatTRY(v.price.amount)} (stok: ${v.stock})`)
        .join("\n");
      const content = [
        p.name,
        p.description ?? "",
        `Fiyat: ${formatTRY(p.price.amount)}`,
        `Toplam stok: ${p.stock}`,
        variantLines,
        p.url ?? "",
      ]
        .filter(Boolean)
        .join("\n");
      return { product: p, content };
    });

    // One embeddings call per page instead of one per product — the per-item
    // path blew the function's time budget on real catalogs.
    let vectors: number[][] = [];
    if (isConfigured.embeddings() && items.length > 0) {
      try {
        vectors = await embedBatch(
          items.map((it) => `${it.product.name}\n${it.content}`)
        );
      } catch (err) {
        console.error("[sync-products] batch embedding failed", err);
      }
    }

    // Upsert concurrently (3 DB roundtrips each; strictly sequential they
    // dominated the runtime — 6 items/min observed). Chunked to stay within
    // the pooled connection limit.
    const CHUNK = 10;
    for (let j = 0; j < items.length; j += CHUNK) {
      await Promise.all(
        items.slice(j, j + CHUNK).map((it, k) =>
          upsertKnowledgeItem(
            {
              merchantId,
              type: "PRODUCT",
              title: it.product.name,
              content: it.content,
              sourceRef: it.product.id,
            },
            vectors[j + k]
          )
        )
      );
    }

    if (!page.hasNextPage) break;
    cursor = page.cursor;
  }
}
