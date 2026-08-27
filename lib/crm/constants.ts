export const LEAD_STAGES = ["YENI", "GORUSMEDE", "TAKIP", "OLUMLU", "OLUMSUZ"] as const;
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
}

/** Board data plus whether we could resolve a tenant at all. */
export interface LeadBoardState {
  leads: LeadDTO[];
  /** false = no store session / no DB, so the empty board is NOT "no leads". */
  connected: boolean;
}
