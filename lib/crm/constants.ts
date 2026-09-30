export const LEAD_STAGES = ["YENI", "IADE_TALEP", "TAKIP", "OLUMLU", "OLUMSUZ"] as const;
export type LeadStageKey = (typeof LEAD_STAGES)[number];

export interface LeadDTO {
  id: string;
  name: string;
  contact: string | null;
  note: string | null;
  stage: LeadStageKey;
  tags: string[];
  /** Set when the lead was captured by the AI from a conversation. */
  conversationId: string | null;
  createdAt: string;
  /**
   * The conversation's own channel identity (customerExtId is the real
   * WhatsApp number / Instagram-scoped id; customerName is the platform
   * display name). Null for manually-added leads with no linked conversation.
   * Shown as a fallback when `contact` above was never typed out in the chat.
   */
  source: {
    channel: string;
    customerExtId: string;
    customerName: string | null;
  } | null;
}

/** Board data plus whether we could resolve a tenant at all. */
export interface LeadBoardState {
  leads: LeadDTO[];
  /** false = no store session / no DB, so the empty board is NOT "no leads". */
  connected: boolean;
}
