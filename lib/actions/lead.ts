"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isConfigured } from "@/lib/config/env";
import { getCurrentMerchantId } from "@/lib/auth/session";
import { createLead, listLeads, moveLead } from "@/lib/db/lead";
import { LEAD_STAGES, type LeadDTO, type LeadStageKey } from "@/lib/crm/constants";

export async function getLeads(): Promise<LeadDTO[]> {
  if (!isConfigured.database()) return [];
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return [];
  const rows = await listLeads(merchantId);
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    contact: r.contact,
    stage: r.stage as LeadStageKey,
    tags: r.tags,
  }));
}

const addSchema = z.object({
  name: z.string().min(1).max(120),
  contact: z.string().max(160).optional(),
  stage: z.enum(LEAD_STAGES).default("YENI"),
});

export async function addLead(input: z.infer<typeof addSchema>) {
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) throw new Error("No store in session");
  const data = addSchema.parse(input);
  await createLead({ merchantId, ...data });
  revalidatePath("/crm");
}

export async function moveLeadAction(
  leadId: string,
  stage: LeadStageKey,
  position: number
) {
  const merchantId = await getCurrentMerchantId();
  if (!merchantId) return;
  await moveLead(merchantId, leadId, stage, position);
  revalidatePath("/crm");
}
