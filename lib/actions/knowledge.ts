"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isConfigured } from "@/lib/config/env";
import { getCurrentMerchantId } from "@/lib/auth/session";
import {
  deleteKnowledgeItem,
  listKnowledgeItems,
  upsertKnowledgeItem,
} from "@/lib/db/knowledge";
import { embed } from "@/lib/ai/rag";
import { logEvent } from "@/lib/db/audit";
import { prisma } from "@/lib/db/client";

const createSchema = z.object({
  type: z.enum(["FAQ", "DOCUMENT", "PRODUCT", "POLICY"]),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
});

export type KnowledgeRow = {
  id: string;
  type: string;
  title: string;
  content: string;
  /** CORRECTION rows only: the wrong answer this entry replaced. */
  badAnswer: string | null;
};

/** Tenant-scoped: merchantId always from session, never the form. */
export async function getKnowledgeItems(): Promise<KnowledgeRow[]> {
  if (!isConfigured.database()) return [];
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return [];
  const items = await listKnowledgeItems(merchantId);
  return items.map((i) => ({
    id: i.id,
    type: i.type,
    title: i.title,
    content: i.content,
    badAnswer: i.badAnswer,
  }));
}

export async function createKnowledgeItem(input: z.infer<typeof createSchema>) {
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) throw new Error("No store in session");
  const parsed = createSchema.parse(input);
  await upsertKnowledgeItem({ merchantId, ...parsed });
  revalidatePath("/bilgi-bankasi");
}

export async function removeKnowledgeItem(id: string) {
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) throw new Error("No store in session");
  await deleteKnowledgeItem(merchantId, id);
  revalidatePath("/bilgi-bankasi");
}

const correctionSchema = z.object({
  /** The customer question the wrong answer was given to. */
  question: z.string().trim().min(3).max(500),
  /** What the agent actually replied. */
  badAnswer: z.string().trim().min(1).max(4000),
  /** What it should have replied. */
  correctAnswer: z.string().trim().min(1).max(4000),
  /** Where the correction came from, for the audit trail. */
  conversationId: z.string().nullable().default(null),
  messageId: z.string().nullable().default(null),
});

export type CorrectionResult = { ok: true; id: string } | { ok: false; error: string };

/**
 * Save a merchant-reviewed fix for a wrong answer. Stored as a CORRECTION
 * knowledge item whose embedding is the QUESTION — retrieval matches what the
 * next customer asks, not how the agent phrased its mistake. Re-correcting the
 * same message updates the existing row instead of stacking duplicates.
 */
export async function saveCorrection(
  input: z.input<typeof correctionSchema>
): Promise<CorrectionResult> {
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return { ok: false, error: "no-session" };
  const parsed = correctionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { question, badAnswer, correctAnswer, conversationId, messageId } = parsed.data;

  let vector: number[] | undefined;
  try {
    vector = await embed(question);
  } catch {
    // No embeddings key: the row is still saved and listed, it just won't be
    // retrievable until an embedding can be computed.
    vector = undefined;
  }

  const id = await upsertKnowledgeItem(
    {
      merchantId,
      type: "CORRECTION",
      title: question,
      content: correctAnswer,
      badAnswer,
      sourceRef: messageId ? `correction:${messageId}` : undefined,
    },
    vector
  );

  await logEvent({
    merchantId,
    conversationId: conversationId ?? undefined,
    type: "answer.corrected",
    data: { knowledgeItemId: id, question },
  }).catch(() => {});

  revalidatePath("/bilgi-bankasi");
  revalidatePath("/mesajlar");
  return { ok: true, id };
}

/** Message ids that already have a correction, so the inbox can mark them. */
export async function getCorrectedMessageIds(): Promise<string[]> {
  if (!isConfigured.database()) return [];
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return [];
  const rows = await prisma.knowledgeItem.findMany({
    where: { merchantId, type: "CORRECTION", sourceRef: { startsWith: "correction:" } },
    select: { sourceRef: true },
  });
  return rows.flatMap((r) => (r.sourceRef ? [r.sourceRef.replace("correction:", "")] : []));
}
