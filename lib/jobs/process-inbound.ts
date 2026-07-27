import { isConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { getChannelCredentials } from "@/lib/db/channel";
import { getChannelAdapter } from "@/lib/channels/registry";
import { runCustomerAgentTurn } from "@/lib/ai/customer-agent";

/**
 * Process an inbound channel message asynchronously: run the customer-agent
 * pipeline, then send the reply back out through the originating channel
 * adapter (Meta channels). Web Chat is handled inline by its API route, so this
 * is the path for WhatsApp/Instagram/Messenger.
 */
export async function processInbound(payload: {
  merchantId: string;
  conversationId: string;
}): Promise<void> {
  if (!isConfigured.database()) return;

  const reply = await runCustomerAgentTurn(payload);
  if (!reply) return;

  const conversation = await prisma.conversation.findUnique({
    where: { id: payload.conversationId },
    select: { channelId: true, channelType: true, customerExtId: true },
  });
  if (!conversation || conversation.channelType === "WEBCHAT") return;

  const creds = (await getChannelCredentials(conversation.channelId)) ?? {};
  const adapter = getChannelAdapter(conversation.channelType, creds);
  await adapter.sendMessage({
    channelType: conversation.channelType,
    recipientExtId: conversation.customerExtId,
    text: reply,
  });
}
