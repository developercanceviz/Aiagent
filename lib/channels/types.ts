/**
 * Channel-agnostic adapter contract. WebChat is implemented first (Phase 5);
 * WhatsApp / Instagram / Messenger (all Meta Graph API) come in Phase 9 behind
 * this same interface.
 */

export type ChannelType = "WEBCHAT" | "WHATSAPP" | "INSTAGRAM" | "MESSENGER";

export interface InboundMessage {
  channelType: ChannelType;
  /** Platform-scoped sender id (ig id / phone number id / web session id). */
  senderExtId: string;
  senderName?: string;
  text: string;
  raw?: unknown;
  receivedAt: Date;
}

export interface OutboundMessage {
  channelType: ChannelType;
  recipientExtId: string;
  text: string;
}

export interface ChannelAdapter {
  readonly type: ChannelType;

  /** Verify an incoming webhook (signature / challenge). */
  verifyWebhook(req: Request): Promise<boolean>;

  /** Normalize a raw provider payload into one or more InboundMessages. */
  normalizeInbound(payload: unknown): Promise<InboundMessage[]>;

  /** Receive (ack + enqueue) — the entry point a webhook route calls. */
  receiveMessage(message: InboundMessage): Promise<void>;

  /** Send a reply back out through the provider. */
  sendMessage(message: OutboundMessage): Promise<void>;
}
