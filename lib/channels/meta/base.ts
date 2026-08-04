import { createHmac, timingSafeEqual } from "node:crypto";

import type { InboundMessage } from "@/lib/channels/types";

const GRAPH_VERSION = "v21.0";
export const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;
/** Instagram-business-login tokens live on their own Graph host. */
export const IG_GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;

/**
 * Verify a Meta webhook signature (X-Hub-Signature-256: sha256=<hex>) against
 * the raw body. More than one signing secret is expected in production: the
 * Instagram-login app signs with its own Instagram app secret while the
 * WhatsApp app signs with its Meta app secret — META_APP_SECRET holds the
 * primary and META_APP_SECRETS (comma-separated) any additional ones.
 */
function metaAppSecrets(): string[] {
  return [process.env.META_APP_SECRET, ...(process.env.META_APP_SECRETS ?? "").split(",")]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
}

export function verifyMetaSignature(raw: string, header: string | null): boolean {
  const secrets = metaAppSecrets();
  if (secrets.length === 0 || !header) return false;
  for (const secret of secrets) {
    const expected =
      "sha256=" + createHmac("sha256", secret).update(raw).digest("hex");
    try {
      if (timingSafeEqual(Buffer.from(expected), Buffer.from(header))) return true;
    } catch {
      // length mismatch — try the next secret
    }
  }
  return false;
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
        message?: { text?: string; is_echo?: boolean };
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
    // Messenger / Instagram DM. Meta echoes the business's own outbound
    // messages back on the webhook (is_echo) — skip them or the agent
    // replies to itself in a loop.
    for (const m of entry.messaging ?? []) {
      if (!m.message?.text || !m.sender?.id || m.message.is_echo) continue;
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
