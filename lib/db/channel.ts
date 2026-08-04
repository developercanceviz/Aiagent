import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { decryptSecret } from "@/lib/crypto/secrets";
import type { ChannelType } from "@prisma/client";

export interface ChannelCredentials {
  /** Page / WhatsApp / Instagram access token (Meta). */
  accessToken?: string;
  phoneNumberId?: string;
  pageId?: string;
  igId?: string;
  /**
   * Which Graph host the token belongs to. Instagram-business-login tokens
   * only work against graph.instagram.com; page/WhatsApp tokens use
   * graph.facebook.com (the default).
   */
  apiBase?: "facebook" | "instagram";
}

/** Find a channel by its provider-side external id (page id / phone number id). */
export async function findChannelByExternalId(externalId: string) {
  if (!isConfigured.database()) return null;
  return prisma.channel.findFirst({ where: { externalId } });
}

export async function getChannelCredentials(
  channelId: string
): Promise<ChannelCredentials | null> {
  if (!isConfigured.database()) return null;
  const channel = await prisma.channel.findUnique({ where: { id: channelId } });
  if (!channel?.credentials) return null;
  try {
    return JSON.parse(decryptSecret(channel.credentials)) as ChannelCredentials;
  } catch {
    return null;
  }
}

export async function isChannelAiEnabled(
  merchantId: string,
  type: ChannelType
): Promise<boolean> {
  if (!isConfigured.database()) return true;
  const channel = await prisma.channel.findFirst({ where: { merchantId, type } });
  return channel?.aiEnabled ?? true;
}
