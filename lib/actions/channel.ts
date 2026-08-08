"use server";

import { revalidatePath } from "next/cache";

import { isConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { getCurrentMerchantId } from "@/lib/auth/session";
import type { ChannelType } from "@prisma/client";

/** The four channel slots the settings page always shows, in display order. */
const CHANNEL_SLOTS: { type: ChannelType; label: string }[] = [
  { type: "WHATSAPP", label: "WhatsApp" },
  { type: "MESSENGER", label: "Messenger" },
  { type: "WEBCHAT", label: "Web Chat" },
  { type: "INSTAGRAM", label: "Instagram" },
];

export type ChannelSettingRow = {
  /** null when this channel type has no row yet (never connected). */
  id: string | null;
  type: ChannelType;
  label: string;
  displayName: string;
  aiEnabled: boolean;
  connected: boolean;
};

/**
 * Real per-channel AI state for Ayarlar → AI Agent. Returns every slot so the
 * UI shape is stable, marking unconnected ones so their toggle is disabled —
 * previously this page rendered hardcoded rows, so toggling looked successful
 * but never persisted and reverted on the next render.
 */
export async function getChannelSettings(): Promise<ChannelSettingRow[]> {
  const merchantId = isConfigured.database() ? await getCurrentMerchantId() : null;
  const rows = merchantId
    ? await prisma.channel.findMany({
        where: { merchantId },
        select: { id: true, type: true, displayName: true, aiEnabled: true, status: true },
      })
    : [];

  return CHANNEL_SLOTS.map(({ type, label }) => {
    const row = rows.find((r) => r.type === type);
    return {
      id: row?.id ?? null,
      type,
      label,
      displayName: row?.displayName ?? "Bağlı değil",
      // An unconnected slot is never "AI active".
      aiEnabled: row ? row.aiEnabled : false,
      connected: Boolean(row) && row?.status === "CONNECTED",
    };
  });
}

/**
 * Per-channel AI control (Ayarlar → AI Agent "Kanal AI Kontrolü"). Writes
 * Channel.aiEnabled. No-ops gracefully when the DB isn't connected so the UI
 * toggle still feels responsive in demo mode.
 */
export async function setChannelAiEnabled(
  channelId: string,
  enabled: boolean
): Promise<{ ok: boolean; aiEnabled: boolean }> {
  if (!isConfigured.database()) return { ok: false, aiEnabled: !enabled };
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return { ok: false, aiEnabled: !enabled };

  // Tenant-scoped update: a channel id from another merchant matches nothing.
  const res = await prisma.channel.updateMany({
    where: { id: channelId, merchantId },
    data: { aiEnabled: enabled },
  });
  if (res.count === 0) return { ok: false, aiEnabled: !enabled };

  revalidatePath("/ayarlar/ai-agent");
  revalidatePath("/ayarlar/kanallar");
  return { ok: true, aiEnabled: enabled };
}
