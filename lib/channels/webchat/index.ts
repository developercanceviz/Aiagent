import type {
  ChannelAdapter,
  InboundMessage,
  OutboundMessage,
} from "@/lib/channels/types";

/**
 * WebChat channel adapter — the first live channel. Web Chat has no external
 * provider to verify or call out to: inbound arrives directly at our API and
 * the "send" is the streamed/persisted reply consumed by the embedded widget.
 * Implementing the interface keeps it symmetric with the Meta channels.
 */
export class WebChatAdapter implements ChannelAdapter {
  readonly type = "WEBCHAT" as const;

  async verifyWebhook(): Promise<boolean> {
    // Web Chat posts to our own origin; auth is via the merchant id + CORS.
    return true;
  }

  async normalizeInbound(payload: unknown): Promise<InboundMessage[]> {
    const p = payload as {
      sessionId?: string;
      message?: string;
      customerName?: string;
    };
    if (!p?.sessionId || !p?.message) return [];
    return [
      {
        channelType: "WEBCHAT",
        senderExtId: p.sessionId,
        senderName: p.customerName,
        text: p.message,
        receivedAt: new Date(),
        raw: payload,
      },
    ];
  }

  async receiveMessage(_message: InboundMessage): Promise<void> {
    // Handled inline by app/api/chat/webchat (streaming). No queue needed.
  }

  async sendMessage(_message: OutboundMessage): Promise<void> {
    // The reply is streamed back over the same HTTP response + persisted.
  }
}
