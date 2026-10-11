import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { embed } from "@/lib/ai/rag";
import type { KbType } from "@prisma/client";

/**
 * Upsert a knowledge item and (when embeddings are configured) store its
 * pgvector embedding. Keyed by (merchantId, sourceRef) for products so
 * re-syncs update in place. The embedding column is Unsupported() in Prisma,
 * so it's written via a raw query.
 */
export async function upsertKnowledgeItem(
  args: {
    merchantId: string;
    type: KbType;
    title: string;
    content: string;
    sourceRef?: string;
    /** CORRECTION only: the wrong answer being replaced. */
    badAnswer?: string | null;
  },
  /** Precomputed embedding (batch path) — skips the per-item embed call. */
  precomputedVector?: number[]
): Promise<string> {
  const existing = args.sourceRef
    ? await prisma.knowledgeItem.findFirst({
        where: { merchantId: args.merchantId, sourceRef: args.sourceRef },
        select: { id: true },
      })
    : null;

  const row = existing
    ? await prisma.knowledgeItem.update({
        where: { id: existing.id },
        data: {
          title: args.title,
          content: args.content,
          type: args.type,
          ...(args.badAnswer !== undefined ? { badAnswer: args.badAnswer } : {}),
        },
      })
    : await prisma.knowledgeItem.create({
        data: {
          merchantId: args.merchantId,
          type: args.type,
          title: args.title,
          content: args.content,
          sourceRef: args.sourceRef,
          badAnswer: args.badAnswer ?? null,
        },
      });

  if (precomputedVector || isConfigured.embeddings()) {
    try {
      const vector =
        precomputedVector ?? (await embed(`${args.title}\n${args.content}`));
      const literal = `[${vector.join(",")}]`;
      await prisma.$executeRawUnsafe(
        `UPDATE "knowledge_items" SET embedding = $1::vector WHERE id = $2`,
        literal,
        row.id
      );
    } catch (err) {
      console.error("[knowledge] embedding failed", err);
    }
  }

  return row.id;
}

export async function listKnowledgeItems(merchantId: string, type?: KbType) {
  return prisma.knowledgeItem.findMany({
    where: { merchantId, ...(type ? { type } : {}) },
    orderBy: { updatedAt: "desc" },
  });
}

export async function deleteKnowledgeItem(merchantId: string, id: string) {
  await prisma.knowledgeItem.deleteMany({ where: { id, merchantId } });
}

/**
 * Remove PRODUCT knowledge items whose source product is no longer in the
 * catalog — a full `syncProductsToKnowledge` run only ever upserts what
 * `listProducts` currently returns, so a discontinued product's entry
 * otherwise sits there forever (seen live: 15 products deleted from ikas
 * back in July still had stale entries today, including the raw-variant-id
 * leak a re-sync of *current* products can no longer touch). Call once after
 * a full catalog pass with every sourceRef seen in it.
 */
export async function pruneProductKnowledge(
  merchantId: string,
  keepSourceRefs: string[]
): Promise<number> {
  // An empty list almost certainly means the catalog fetch came back empty
  // (error, misconfigured adapter) rather than a genuinely empty store —
  // never wipe every product entry on that basis.
  if (keepSourceRefs.length === 0) return 0;
  const res = await prisma.knowledgeItem.deleteMany({
    where: { merchantId, type: "PRODUCT", sourceRef: { notIn: keepSourceRefs } },
  });
  return res.count;
}
