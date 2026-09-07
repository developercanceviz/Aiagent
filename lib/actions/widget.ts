"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentMerchantId } from "@/lib/auth/session";
import { isConfigured } from "@/lib/config/env";
import { widgetThemes } from "@/lib/config/widget-themes";
import { defaultWidgetConfig, getWidgetConfig, upsertWidgetConfig } from "@/lib/db/widget";
import { prisma } from "@/lib/db/client";

export interface WidgetSettings {
  /** false when there's no DB or no session — the page then runs read-only. */
  editable: boolean;
  /** WidgetConfig.active — the kill switch /widget.js reads before rendering. */
  active: boolean;
  theme: string;
  bubbleSize: number;
}

/** Current Web Chat widget state for Ayarlar → Web Chat. */
export async function getWidgetSettings(): Promise<WidgetSettings> {
  const merchantId = isConfigured.database() ? await getCurrentMerchantId() : null;
  if (!merchantId) {
    return {
      editable: false,
      active: defaultWidgetConfig.active,
      theme: defaultWidgetConfig.theme,
      bubbleSize: defaultWidgetConfig.bubbleSize,
    };
  }
  const cfg = await getWidgetConfig(merchantId);
  return { editable: true, active: cfg.active, theme: cfg.theme, bubbleSize: cfg.bubbleSize };
}

/**
 * The store-visibility kill switch. Flipping this off makes
 * /api/widget/<id>/config report `active: false`, which the embedded loader
 * checks before it renders anything — so the bubble disappears from the
 * storefront on the next page load, with no re-deploy and no theme edit
 * needed. Nothing else about the widget changes, so flipping it back on
 * restores the exact same configuration.
 */
export async function setWidgetActive(
  active: boolean
): Promise<{ ok: boolean; active: boolean }> {
  if (!isConfigured.database()) return { ok: false, active: !active };
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return { ok: false, active: !active };

  await upsertWidgetConfig(merchantId, { active });
  await syncWebChatChannel(merchantId, active);
  revalidatePath("/ayarlar/web-chat");
  revalidatePath("/ayarlar/ai-agent");
  revalidatePath("/ayarlar/kanallar");
  return { ok: true, active };
}

/**
 * Keeps the WEBCHAT Channel row (what Ayarlar → AI Agent's "Kanal AI
 * Kontrolü" reads) in sync with the widget's own on/off switch — previously
 * these were two independent flags, so a merchant could activate the widget
 * here and still see "Bağlı değil" on the channel-toggle page. Web Chat has
 * no external OAuth connect step (unlike Meta channels), so this is the only
 * place a row gets created.
 */
async function syncWebChatChannel(merchantId: string, active: boolean) {
  const existing = await prisma.channel.findFirst({
    where: { merchantId, type: "WEBCHAT" },
    select: { id: true },
  });
  const status = active ? "CONNECTED" : "DISCONNECTED";
  if (existing) {
    await prisma.channel.update({ where: { id: existing.id }, data: { status } });
  } else {
    await prisma.channel.create({
      data: {
        merchantId,
        type: "WEBCHAT",
        displayName: "Web Sitesi",
        status,
        aiEnabled: true,
      },
    });
  }
}

const publishInput = z.object({
  theme: z.string().min(1),
  bubbleSize: z.number().int().min(40).max(80),
});

/**
 * "Güncelle & Yayınla" — persists the appearance the page is previewing.
 * Colors come from the preset theme (never from the client) so a tampered
 * payload can't write arbitrary CSS values into the storefront widget.
 */
export async function publishWidgetSettings(
  input: z.input<typeof publishInput>
): Promise<{ ok: boolean }> {
  const parsed = publishInput.safeParse(input);
  if (!parsed.success) return { ok: false };
  const theme = widgetThemes.find((t) => t.key === parsed.data.theme);
  if (!theme) return { ok: false };

  if (!isConfigured.database()) return { ok: false };
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return { ok: false };

  await upsertWidgetConfig(merchantId, {
    theme: theme.key,
    primaryColor: theme.primaryColor,
    headerBg: theme.headerBg,
    headerText: theme.headerText,
    userMsgColor: theme.userMsgColor,
    botMsgColor: theme.botMsgColor,
    bubbleColor: theme.bubbleColor,
    bubbleIcon: theme.bubbleIcon,
    bubbleSize: parsed.data.bubbleSize,
  });
  revalidatePath("/ayarlar/web-chat");
  return { ok: true };
}
