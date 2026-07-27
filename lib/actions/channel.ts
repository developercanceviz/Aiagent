"use server";

import { revalidatePath } from "next/cache";

import { isConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { getCurrentMerchantId } from "@/lib/auth/session";

/**
 * Per-channel AI control (Ayarlar → AI Agent "Kanal AI Kontrolü"). Writes
 * Channel.aiEnabled. No-ops gracefully when the DB isn't connected so the UI
 * toggle still feels responsive in demo mode.
 */
export async function setChannelAiEnabled(channelId: string, enabled: boolean) {
  if (!isConfigured.database() || channelId.startsWith("mock-")) return;
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return;
  await prisma.channel.updateMany({
    where: { id: channelId, merchantId },
    data: { aiEnabled: enabled },
  });
  revalidatePath("/ayarlar/ai-agent");
}
