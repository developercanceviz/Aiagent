import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";

export interface WidgetConfigDTO {
  theme: string;
  primaryColor: string;
  headerBg: string;
  headerText: string;
  userMsgColor: string;
  botMsgColor: string;
  bubbleColor: string;
  bubbleIcon: string;
  bubbleSize: number;
  position: string;
  greeting: string;
  socialLinks: Record<string, string> | null;
  active: boolean;
  storeName: string;
}

export const defaultWidgetConfig: WidgetConfigDTO = {
  theme: "creato",
  primaryColor: "#14DAAA",
  headerBg: "#101216",
  headerText: "#FFFFFF",
  userMsgColor: "#14DAAA",
  botMsgColor: "#F4F4F5",
  bubbleColor: "#14DAAA",
  bubbleIcon: "#101216",
  bubbleSize: 60,
  position: "bottom-right",
  greeting: "Merhaba! 👋 Size nasıl yardımcı olabilirim?",
  socialLinks: null,
  active: true,
  storeName: "Canceviz Hurma",
};

/** Public widget config for a merchant (falls back to defaults). */
export async function getWidgetConfig(merchantId: string): Promise<WidgetConfigDTO> {
  if (!isConfigured.database()) return defaultWidgetConfig;
  const [cfg, merchant] = await Promise.all([
    prisma.widgetConfig.findUnique({ where: { merchantId } }),
    prisma.merchant.findUnique({ where: { id: merchantId }, select: { storeName: true } }),
  ]);
  if (!cfg) return { ...defaultWidgetConfig, storeName: merchant?.storeName ?? defaultWidgetConfig.storeName };
  return {
    theme: cfg.theme,
    primaryColor: cfg.primaryColor,
    headerBg: cfg.headerBg,
    headerText: cfg.headerText,
    userMsgColor: cfg.userMsgColor,
    botMsgColor: cfg.botMsgColor,
    bubbleColor: cfg.bubbleColor,
    bubbleIcon: cfg.bubbleIcon,
    bubbleSize: cfg.bubbleSize,
    position: cfg.position,
    greeting: cfg.greeting,
    socialLinks: (cfg.socialLinks as Record<string, string> | null) ?? null,
    active: cfg.active,
    storeName: merchant?.storeName ?? defaultWidgetConfig.storeName,
  };
}

export async function upsertWidgetConfig(
  merchantId: string,
  data: Partial<Omit<WidgetConfigDTO, "storeName">>
) {
  const { socialLinks, ...rest } = data;
  // Map our DTO's `null` onto Prisma's JSON null sentinel.
  const social =
    socialLinks === undefined
      ? undefined
      : socialLinks === null
        ? Prisma.JsonNull
        : (socialLinks as Prisma.InputJsonValue);

  return prisma.widgetConfig.upsert({
    where: { merchantId },
    update: { ...rest, ...(social !== undefined ? { socialLinks: social } : {}) },
    create: { merchantId, ...rest, ...(social !== undefined ? { socialLinks: social } : {}) },
  });
}
