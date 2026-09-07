"use server";

import { revalidatePath } from "next/cache";

import { isConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { getCurrentMerchantId } from "@/lib/auth/session";
import { upsertWidgetConfig } from "@/lib/db/widget";
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
 *
 * For WEBCHAT specifically this also mirrors WidgetConfig.active — before this,
 * the two "off" switches for Web Chat (this one and Ayarlar → Web Chat's own
 * Aktif/Pasif) were independent: turning this one off showed "Pasif" here but
 * left the floating bubble live on the storefront, since only WidgetConfig.active
 * gates what the embedded widget.js renders. Keeping them in sync means either
 * switch reliably controls whether the bubble shows.
 */
export async function setChannelAiEnabled(
  channelId: string,
  enabled: boolean
): Promise<{ ok: boolean; aiEnabled: boolean }> {
  if (!isConfigured.database()) return { ok: false, aiEnabled: !enabled };
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return { ok: false, aiEnabled: !enabled };

  // Tenant-scoped update: a channel id from another merchant matches nothing.
  const channel = await prisma.channel.findFirst({
    where: { id: channelId, merchantId },
    select: { type: true },
  });
  if (!channel) return { ok: false, aiEnabled: !enabled };

  await prisma.channel.update({ where: { id: channelId }, data: { aiEnabled: enabled } });
  if (channel.type === "WEBCHAT") {
    await upsertWidgetConfig(merchantId, { active: enabled });
    revalidatePath("/ayarlar/web-chat");
  }

  revalidatePath("/ayarlar/ai-agent");
  revalidatePath("/ayarlar/kanallar");
  return { ok: true, aiEnabled: enabled };
}
