export const LEAD_STAGES = ["YENI", "GORUSMEDE", "TAKIP", "OLUMLU", "OLUMSUZ"] as const;
export type LeadStageKey = (typeof LEAD_STAGES)[number];

export interface LeadDTO {
  id: string;
  name: string;
  contact: string | null;
  stage: LeadStageKey;
  tags: string[];
}
