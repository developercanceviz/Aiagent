import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { getMerchantAdapter } from "@/lib/db/merchant";
import { pruneProductKnowledge, upsertKnowledgeItem } from "@/lib/db/knowledge";
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

  // Every call does a full catalog pass (there's no single-product payload
  // shape today), so the ids seen here are authoritative for what should
  // exist afterward — anything else is a discontinued product whose
  // knowledge entry would otherwise never get cleaned up.
  const seenProductIds: string[] = [];

  let cursor: string | undefined;
  for (let i = 0; i < 50; i++) {
    const page = await adapter.listProducts({ cursor, limit: 50 });

    // price is always the effective (discounted, if a campaign is active)
    // price; compareAtPrice — when present — is the pre-discount list price.
    // Recording both means a stale knowledge-base read still shows the right
    // price to pay, not the discount-less sellPrice.
    const priceLine = (amount: number, currency: string, compareAt?: { amount: number }) =>
      compareAt
        ? `${formatTRY(amount)} (İndirimli fiyat; normal fiyat ${formatTRY(compareAt.amount)})`
        : formatTRY(amount);
    // Customer-facing: "var"/"yok" only — never the real count (merchant
    // request). variant.title used to fall back to the raw ikas variant id
    // when no SKU was set, which the agent then read back verbatim as a
    // "Kod:" line (seen live: a raw uuid quoted to a customer) — variants
    // are distinguished by their price line alone now, no id/SKU at all.
    const stockLabel = (stock: number) => (stock > 0 ? "Stokta var" : "Stokta yok");

    const items = page.data.map((p) => {
      const variantLines =
        p.variants.length > 1
          ? p.variants
              .map(
                (v) =>
                  `- ${priceLine(v.price.amount, v.price.currency, v.compareAtPrice)} (${stockLabel(v.stock)})`
              )
              .join("\n")
          : "";
      const content = [
        p.name,
        p.description ?? "",
        `Fiyat: ${priceLine(p.price.amount, p.price.currency, p.compareAtPrice)}`,
        `Stok durumu: ${stockLabel(p.stock)}`,
        variantLines,
        p.url ?? "",
      ]
        .filter(Boolean)
        .join("\n");
      return { product: p, content };
    });

    seenProductIds.push(...items.map((it) => it.product.id));

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

  const pruned = await pruneProductKnowledge(merchantId, seenProductIds);
  if (pruned > 0) {
    console.log(`[sync-products] pruned ${pruned} discontinued product(s) from knowledge base`);
  }
}
