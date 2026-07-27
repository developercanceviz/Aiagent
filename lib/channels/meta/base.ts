import { createHmac, timingSafeEqual } from "node:crypto";

import type { InboundMessage } from "@/lib/channels/types";

const GRAPH_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

/**
 * Verify a Meta webhook signature (X-Hub-Signature-256: sha256=<hex>) against
 * the raw body using META_APP_SECRET.
 */
export function verifyMetaSignature(raw: string, header: string | null): boolean {
  const secret = process.env.META_APP_SECRET;
  if (!secret || !header) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(header));
  } catch {
    return false;
  }
}

/** GET verification handshake (hub.challenge) for Meta webhook subscription. */
export function handleMetaVerification(params: URLSearchParams): string | null {
  const mode = params.get("hub.mode");
  const token = params.get("hub.verify_token");
  const challenge = params.get("hub.challenge");
  if (mode === "subscribe" && token && token === process.env.META_VERIFY_TOKEN) {
    return challenge;
  }
  return null;
}

/**
 * Normalize a raw Meta webhook body into InboundMessages, handling both the
 * Messenger/Instagram `messaging[]` shape and the WhatsApp `changes[].value`
 * shape. `externalId` is the receiving channel id (page id / phone number id)
 * used to resolve the tenant.
 */
export function normalizeMetaPayload(payload: unknown): Array<
  InboundMessage & { externalId: string }
> {
  const out: Array<InboundMessage & { externalId: string }> = [];
  const body = payload as {
    object?: string;
    entry?: Array<{
      id?: string;
      messaging?: Array<{
        sender?: { id?: string };
        message?: { text?: string };
      }>;
      changes?: Array<{
        value?: {
          metadata?: { phone_number_id?: string };
          contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
          messages?: Array<{ from?: string; text?: { body?: string } }>;
        };
      }>;
    }>;
  };

  for (const entry of body.entry ?? []) {
    // Messenger / Instagram DM
    for (const m of entry.messaging ?? []) {
      if (!m.message?.text || !m.sender?.id) continue;
      out.push({
        channelType: body.object === "instagram" ? "INSTAGRAM" : "MESSENGER",
        senderExtId: m.sender.id,
        text: m.message.text,
        receivedAt: new Date(),
        externalId: entry.id ?? "",
        raw: m,
      });
    }
    // WhatsApp
    for (const change of entry.changes ?? []) {
      const value = change.value;
      const phoneId = value?.metadata?.phone_number_id ?? "";
      const name = value?.contacts?.[0]?.profile?.name;
      for (const msg of value?.messages ?? []) {
        if (!msg.text?.body || !msg.from) continue;
        out.push({
          channelType: "WHATSAPP",
          senderExtId: msg.from,
          senderName: name,
          text: msg.text.body,
          receivedAt: new Date(),
          externalId: phoneId,
          raw: msg,
        });
      }
    }
  }
  return out;
}
