"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { isConfigured } from "@/lib/config/env";
import { getCurrentMerchantId } from "@/lib/auth/session";
import { createLead, deleteLead, listLeads, moveLead, updateLead } from "@/lib/db/lead";
import {
  LEAD_STAGES,
  type LeadBoardState,
  type LeadDTO,
  type LeadStageKey,
} from "@/lib/crm/constants";

/**
 * Every mutation here answers with a typed result instead of throwing. The
 * board used to fire these with `.catch(() => {})`, so a failed write (expired
 * session, stale id) looked exactly like a successful one until the next
 * reload. Callers must render `error` — silence is the bug we're fixing.
 */
export type LeadResult<T = never> =
  | { ok: true; lead?: T }
  | { ok: false; error: LeadError };

/** Machine-readable so the client can map it to a translated message. */
export type LeadError = "no-session" | "invalid" | "not-found";

type Row = Awaited<ReturnType<typeof listLeads>>[number];

function toDTO(r: Row): LeadDTO {
  return {
    id: r.id,
    name: r.name,
    contact: r.contact,
    note: r.note,
    stage: r.stage as LeadStageKey,
    tags: r.tags,
    conversationId: r.conversationId,
  };
}

async function tenant(): Promise<string | null> {
  if (!isConfigured.database()) return null;
  return getCurrentMerchantId();
}

export async function getLeadBoard(): Promise<LeadBoardState> {
  const merchantId = await tenant();
  if (!merchantId) return { leads: [], connected: false };
  return { leads: (await listLeads(merchantId)).map(toDTO), connected: true };
}

const leadInput = z.object({
  name: z.string().trim().min(1).max(120),
  contact: z.string().trim().max(160).nullable().default(null),
  note: z.string().trim().max(2000).nullable().default(null),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  stage: z.enum(LEAD_STAGES).default("YENI"),
});

export async function addLead(
  input: z.input<typeof leadInput>
): Promise<LeadResult<LeadDTO>> {
  const merchantId = await tenant();
  if (!merchantId) return { ok: false, error: "no-session" };
  const parsed = leadInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const row = await createLead({ merchantId, ...parsed.data });
  revalidatePath("/crm");
  // The real row goes back to the client so the optimistic card can adopt its
  // id — otherwise the card keeps a client-generated uuid and the next drag
  // updates nothing.
  return { ok: true, lead: toDTO(row) };
}

export async function moveLeadAction(
  leadId: string,
  stage: LeadStageKey
): Promise<LeadResult> {
  const merchantId = await tenant();
  if (!merchantId) return { ok: false, error: "no-session" };
  if (!LEAD_STAGES.includes(stage)) return { ok: false, error: "invalid" };

  const moved = await moveLead(merchantId, leadId, stage);
  if (!moved) return { ok: false, error: "not-found" };
  revalidatePath("/crm");
  return { ok: true };
}

const patchInput = leadInput.partial();

export async function updateLeadAction(
  leadId: string,
  patch: z.input<typeof patchInput>
): Promise<LeadResult> {
  const merchantId = await tenant();
  if (!merchantId) return { ok: false, error: "no-session" };
  const parsed = patchInput.safeParse(patch);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const updated = await updateLead(merchantId, leadId, parsed.data);
  if (!updated) return { ok: false, error: "not-found" };
  revalidatePath("/crm");
  return { ok: true };
}

export async function deleteLeadAction(leadId: string): Promise<LeadResult> {
  const merchantId = await tenant();
  if (!merchantId) return { ok: false, error: "no-session" };
  const deleted = await deleteLead(merchantId, leadId);
  if (!deleted) return { ok: false, error: "not-found" };
  revalidatePath("/crm");
  return { ok: true };
}
