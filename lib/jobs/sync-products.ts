import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { getMerchantAdapter } from "@/lib/db/merchant";
import { upsertKnowledgeItem } from "@/lib/db/knowledge";
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
    for (const p of page.data) {
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

      await upsertKnowledgeItem({
        merchantId,
        type: "PRODUCT",
        title: p.name,
        content,
        sourceRef: p.id,
      });
    }
    if (!page.hasNextPage) break;
    cursor = page.cursor;
  }
}
