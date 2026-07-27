import type { ChannelAdapter, ChannelType } from "@/lib/channels/types";
import type { ChannelCredentials } from "@/lib/db/channel";
import { WebChatAdapter } from "@/lib/channels/webchat";
import {
  InstagramAdapter,
  MessengerAdapter,
  WhatsAppAdapter,
} from "@/lib/channels/meta/adapters";

/** Resolve a channel adapter by type. Credentials required for Meta channels. */
export function getChannelAdapter(
  type: ChannelType,
  creds: ChannelCredentials = {}
): ChannelAdapter {
  switch (type) {
    case "WEBCHAT":
      return new WebChatAdapter();
    case "WHATSAPP":
      return new WhatsAppAdapter(creds);
    case "MESSENGER":
      return new MessengerAdapter(creds);
    case "INSTAGRAM":
      return new InstagramAdapter(creds);
    default: {
      const _exhaustive: never = type;
      throw new Error(`Unknown channel type: ${_exhaustive}`);
    }
  }
}
