import { prisma } from "@/lib/db/client";
import type { ChannelType, MsgRole } from "@prisma/client";

/**
 * Conversation + message data-access. All functions take merchantId explicitly
 * (derived from session/app context by callers) and scope every query to it.
 */

export async function findOrCreateConversation(args: {
  merchantId: string;
  channelId: string;
  channelType: ChannelType;
  customerExtId: string;
  customerName?: string;
}) {
  const existing = await prisma.conversation.findFirst({
    where: {
      merchantId: args.merchantId,
      channelType: args.channelType,
      customerExtId: args.customerExtId,
      archived: false,
    },
  });
  if (existing) return existing;

  return prisma.conversation.create({
    data: {
      merchantId: args.merchantId,
      channelId: args.channelId,
      channelType: args.channelType,
      customerExtId: args.customerExtId,
      customerName: args.customerName,
    },
  });
}

export async function appendMessage(args: {
  conversationId: string;
  role: MsgRole;
  content: string;
  tokensIn?: number;
  tokensOut?: number;
}) {
  const message = await prisma.message.create({ data: args });
  await prisma.conversation.update({
    where: { id: args.conversationId },
    data: {
      lastMessageAt: new Date(),
      ...(args.role === "CUSTOMER" ? { unreadCount: { increment: 1 } } : {}),
      ...(args.role === "AI" ? { status: "AI_HANDLED" } : {}),
    },
  });
  return message;
}

export async function getConversationHistory(conversationId: string, limit = 20) {
  return prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}

export async function listConversations(merchantId: string) {
  return prisma.conversation.findMany({
    // Test conversations live behind the Mesajlar → Test tab; they must not
    // pollute the real inbox or the counts derived from it.
    where: { merchantId, archived: false, isTest: false },
    orderBy: { lastMessageAt: "desc" },
    take: 100,
  });
}

export async function setHandledBy(
  merchantId: string,
  conversationId: string,
  handledBy: "AI" | "HUMAN"
) {
  return prisma.conversation.updateMany({
    where: { id: conversationId, merchantId },
    data: {
      handledBy,
      status: handledBy === "HUMAN" ? "NEEDS_HUMAN" : "AI_HANDLED",
    },
  });
}
