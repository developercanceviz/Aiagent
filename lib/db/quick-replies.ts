import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";

export async function listQuickReplies(merchantId: string) {
  if (!isConfigured.database()) return [];
  return prisma.quickReply.findMany({
    where: { merchantId },
    orderBy: { createdAt: "desc" },
  });
}

export async function createQuickReply(args: {
  merchantId: string;
  title: string;
  content: string;
}) {
  return prisma.quickReply.create({ data: args });
}

export async function deleteQuickReply(merchantId: string, id: string) {
  await prisma.quickReply.deleteMany({ where: { id, merchantId } });
}
