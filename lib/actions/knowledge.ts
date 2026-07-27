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
};

/** Tenant-scoped: merchantId always from session, never the form. */
export async function getKnowledgeItems(): Promise<KnowledgeRow[]> {
  if (!isConfigured.database()) return [];
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return [];
  const items = await listKnowledgeItems(merchantId);
  return items.map((i) => ({ id: i.id, type: i.type, title: i.title, content: i.content }));
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
