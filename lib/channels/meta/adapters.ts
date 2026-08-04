import type {
  ChannelAdapter,
  ChannelType,
  InboundMessage,
  OutboundMessage,
} from "@/lib/channels/types";
import type { ChannelCredentials } from "@/lib/db/channel";
import {
  GRAPH_BASE,
  IG_GRAPH_BASE,
  normalizeMetaPayload,
  verifyMetaSignature,
} from "@/lib/channels/meta/base";

/**
 * Meta Graph API channel adapters (WhatsApp Cloud, Instagram DM, Messenger).
 * They share inbound normalization + signature verification (base.ts) and
 * differ only in the outbound send shape. Credentials are per-channel,
 * decrypted from Channel.credentials by the caller.
 */
abstract class MetaAdapter implements ChannelAdapter {
  abstract readonly type: ChannelType;
  constructor(protected readonly creds: ChannelCredentials) {}

  async verifyWebhook(req: Request): Promise<boolean> {
    const raw = await req.clone().text();
    return verifyMetaSignature(raw, req.headers.get("x-hub-signature-256"));
  }

  async normalizeInbound(payload: unknown): Promise<InboundMessage[]> {
    return normalizeMetaPayload(payload).filter((m) => m.channelType === this.type);
  }

  async receiveMessage(): Promise<void> {
    // Inbound is enqueued by the webhook route; the agent job sends the reply.
  }

  abstract sendMessage(message: OutboundMessage): Promise<void>;

  protected async graphPost(path: string, body: unknown): Promise<void> {
    const token = this.creds.accessToken;
    if (!token) throw new Error(`${this.type}: missing access token`);
    const base =
      this.creds.apiBase === "instagram" ? IG_GRAPH_BASE : GRAPH_BASE;
    const res = await fetch(`${base}/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`${this.type} send failed: ${res.status} ${await res.text()}`);
    }
  }
}

export class WhatsAppAdapter extends MetaAdapter {
  readonly type = "WHATSAPP" as const;
  async sendMessage(message: OutboundMessage): Promise<void> {
    const phoneNumberId = this.creds.phoneNumberId;
    await this.graphPost(`${phoneNumberId}/messages`, {
      messaging_product: "whatsapp",
      to: message.recipientExtId,
      type: "text",
      text: { body: message.text },
    });
  }
}

export class MessengerAdapter extends MetaAdapter {
  readonly type = "MESSENGER" as const;
  async sendMessage(message: OutboundMessage): Promise<void> {
    await this.graphPost(`me/messages`, {
      recipient: { id: message.recipientExtId },
      messaging_type: "RESPONSE",
      message: { text: message.text },
    });
  }
}

export class InstagramAdapter extends MetaAdapter {
  readonly type = "INSTAGRAM" as const;
  async sendMessage(message: OutboundMessage): Promise<void> {
    await this.graphPost(`me/messages`, {
      recipient: { id: message.recipientExtId },
      message: { text: message.text },
    });
  }
}
