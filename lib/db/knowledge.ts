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
export async function upsertKnowledgeItem(args: {
  merchantId: string;
  type: KbType;
  title: string;
  content: string;
  sourceRef?: string;
}): Promise<string> {
  const existing = args.sourceRef
    ? await prisma.knowledgeItem.findFirst({
        where: { merchantId: args.merchantId, sourceRef: args.sourceRef },
        select: { id: true },
      })
    : null;

  const row = existing
    ? await prisma.knowledgeItem.update({
        where: { id: existing.id },
        data: { title: args.title, content: args.content, type: args.type },
      })
    : await prisma.knowledgeItem.create({
        data: {
          merchantId: args.merchantId,
          type: args.type,
          title: args.title,
          content: args.content,
          sourceRef: args.sourceRef,
        },
      });

  if (isConfigured.embeddings()) {
    try {
      const vector = await embed(`${args.title}\n${args.content}`);
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
