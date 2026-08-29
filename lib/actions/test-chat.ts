"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isConfigured } from "@/lib/config/env";
import { getCurrentMerchantId } from "@/lib/auth/session";
import { prisma } from "@/lib/db/client";
import { appendMessage } from "@/lib/db/conversation";
import { runCustomerAgentTurn } from "@/lib/ai/customer-agent";
import type { ChannelType } from "@prisma/client";
import type { InboxMessageDTO } from "@/lib/actions/conversation";

/**
 * Merchant-facing test chat (Mesajlar → Test).
 *
 * The merchant plays the customer and the REAL customer-agent pipeline answers
 * — same prompt, same knowledge base, same tools, same intent rules — so what
 * you see here is what a customer would get. Nothing is sent outward to Meta
 * or the widget: the reply is returned to the caller instead of handed to a
 * channel adapter, which is what makes it safe to try before going live.
 *
 * Test conversations carry isTest=true and are excluded from the real inbox
 * and dashboard counts.
 */

const TEST_CHANNELS = ["WEBCHAT", "INSTAGRAM", "WHATSAPP", "MESSENGER"] as const;
type TestChannel = (typeof TEST_CHANNELS)[number];

export interface TestChatState {
  conversationId: string | null;
  channel: TestChannel;
  messages: InboxMessageDTO[];
}

export type TestChatResult =
  | { ok: true; state: TestChatState }
  | { ok: false; error: string };

async function tenant() {
  if (!isConfigured.database()) return null;
  return getCurrentMerchantId();
}

async function threadOf(conversationId: string): Promise<InboxMessageDTO[]> {
  const msgs = await prisma.message.findMany({
    where: { conversationId },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  return msgs.map((m) => ({
    id: m.id,
    role: m.role,
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));
}

/** The merchant's current test conversation for a channel, if one exists. */
export async function getTestChat(channel: TestChannel): Promise<TestChatState> {
  const merchantId = await tenant();
  if (!merchantId) return { conversationId: null, channel, messages: [] };

  const conv = await prisma.conversation.findFirst({
    where: { merchantId, isTest: true, channelType: channel },
    orderBy: { lastMessageAt: "desc" },
    select: { id: true },
  });
  if (!conv) return { conversationId: null, channel, messages: [] };
  return { conversationId: conv.id, channel, messages: await threadOf(conv.id) };
}

const startInput = z.object({ channel: z.enum(TEST_CHANNELS) });

export async function startTestChat(
  input: z.infer<typeof startInput>
): Promise<TestChatResult> {
  const merchantId = await tenant();
  if (!merchantId) return { ok: false, error: "no-session" };
  const parsed = startInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { channel } = parsed.data;

  // Reuse the merchant's real channel row when there is one, so the
  // conversation looks exactly like an inbound message on that channel.
  const existing = await prisma.channel.findFirst({
    where: { merchantId, type: channel },
    select: { id: true },
  });

  const conv = await prisma.conversation.create({
    data: {
      merchantId,
      channelId: existing?.id ?? `test-${channel.toLowerCase()}`,
      channelType: channel,
      customerExtId: `test:${channel.toLowerCase()}`,
      customerName: "Test müşterisi",
      isTest: true,
    },
    select: { id: true },
  });
  return { ok: true, state: { conversationId: conv.id, channel, messages: [] } };
}

const sendInput = z.object({
  conversationId: z.string().min(1),
  text: z.string().trim().min(1).max(4000),
});

/** Appends the merchant's line as CUSTOMER and returns the agent's reply. */
export async function sendTestMessage(
  input: z.infer<typeof sendInput>
): Promise<TestChatResult> {
  const merchantId = await tenant();
  if (!merchantId) return { ok: false, error: "no-session" };
  const parsed = sendInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { conversationId, text } = parsed.data;

  // Tenant + test scoping: this action must never touch a real conversation.
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, merchantId, isTest: true },
    select: { id: true, channelType: true },
  });
  if (!conv) return { ok: false, error: "not-found" };

  await appendMessage({ conversationId, role: "CUSTOMER", content: text });

  try {
    await runCustomerAgentTurn({ merchantId, conversationId });
  } catch (err) {
    // Surface the real reason (missing AI key, provider error) rather than
    // leaving the tester staring at a silent thread.
    return {
      ok: false,
      error: err instanceof Error ? err.message : "agent-failed",
    };
  }

  revalidatePath("/mesajlar");
  return {
    ok: true,
    state: {
      conversationId,
      channel: conv.channelType as TestChannel,
      messages: await threadOf(conversationId),
    },
  };
}

/** Deletes the test conversation so the tester can start clean. */
export async function resetTestChat(conversationId: string): Promise<TestChatResult> {
  const merchantId = await tenant();
  if (!merchantId) return { ok: false, error: "no-session" };
  const conv = await prisma.conversation.findFirst({
    where: { id: conversationId, merchantId, isTest: true },
    select: { id: true, channelType: true },
  });
  if (!conv) return { ok: false, error: "not-found" };

  await prisma.lead.deleteMany({ where: { conversationId, merchantId } });
  await prisma.conversation.delete({ where: { id: conversationId } });
  revalidatePath("/mesajlar");
  return {
    ok: true,
    state: {
      conversationId: null,
      channel: conv.channelType as TestChannel,
      messages: [],
    },
  };
}

export type { TestChannel };
