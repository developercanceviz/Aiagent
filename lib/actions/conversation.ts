"use server";

import { revalidatePath } from "next/cache";

import { isConfigured } from "@/lib/config/env";
import { getCurrentMerchantId } from "@/lib/auth/session";
import {
  appendMessage,
  getConversationHistory,
  listConversations,
  setHandledBy,
} from "@/lib/db/conversation";
import { logEvent } from "@/lib/db/audit";
import { recentConversations } from "@/lib/mock/dashboard";

export interface InboxMessageDTO {
  id: string;
  role: "CUSTOMER" | "AI" | "HUMAN_AGENT" | "SYSTEM";
  content: string;
  createdAt: string;
}

export interface InboxConversationDTO {
  id: string;
  name: string;
  preview: string;
  time: string;
  channel: string;
  unread: number;
  handledBy: "AI" | "HUMAN";
}

/** Mock conversations so the inbox renders before the DB is connected. */
const mockInbox: InboxConversationDTO[] = recentConversations.map((c, i) => ({
  id: `mock-${i}`,
  name: c.name,
  preview: c.preview,
  time: c.time,
  channel: c.channel,
  unread: i === 0 ? 2 : 0,
  handledBy: "AI",
}));

export async function getInboxConversations(): Promise<InboxConversationDTO[]> {
  if (!isConfigured.database()) return mockInbox;
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return mockInbox;
  const rows = await listConversations(merchantId);
  return rows.map((r) => ({
    id: r.id,
    name: r.customerName ?? "Müşteri",
    preview: "",
    time: r.lastMessageAt.toISOString(),
    channel: r.channelType.toLowerCase(),
    unread: r.unreadCount,
    handledBy: r.handledBy,
  }));
}

export async function getThread(conversationId: string): Promise<InboxMessageDTO[]> {
  if (!isConfigured.database() || conversationId.startsWith("mock-")) {
    return [
      {
        id: "demo-1",
        role: "CUSTOMER",
        content: "Merhaba, 5 kilo hurma ne kadar?",
        createdAt: new Date().toISOString(),
      },
      {
        id: "demo-2",
        role: "AI",
        content:
          "Merhaba! 👋 5 kg jumbo hurmamız şu an stokta. Dilerseniz ürün bağlantısını paylaşabilirim.",
        createdAt: new Date().toISOString(),
      },
    ];
  }
  const msgs = await getConversationHistory(conversationId, 100);
  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}

/** Flip a conversation to human handling (pauses the AI for it). */
export async function takeoverConversation(conversationId: string) {
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return;
  await setHandledBy(merchantId, conversationId, "HUMAN");
  await logEvent({ merchantId, conversationId, type: "human.takeover" });
  revalidatePath("/mesajlar");
}

export async function returnToAi(conversationId: string) {
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return;
  await setHandledBy(merchantId, conversationId, "AI");
  await logEvent({ merchantId, conversationId, type: "human.return" });
  revalidatePath("/mesajlar");
}

export async function sendHumanMessage(conversationId: string, content: string) {
  if (!content.trim()) return;
  await appendMessage({ conversationId, role: "HUMAN_AGENT", content });
  revalidatePath("/mesajlar");
}
