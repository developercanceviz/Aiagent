import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import type { LeadStage } from "@prisma/client";

/**
 * Board order: smallest orderPosition first, newest first as the tiebreaker.
 * New and moved cards get a position *below* the current minimum, so they land
 * at the TOP of their column — where the person who just created or dropped
 * them is looking. (They used to be appended with `count` as the position,
 * which buried a new lead at the bottom of a tall column with no scrollbar —
 * it read as "my lead disappeared on refresh".)
 */
const BOARD_ORDER = [{ orderPosition: "asc" as const }, { createdAt: "desc" as const }];

export async function listLeads(merchantId: string) {
  if (!isConfigured.database()) return [];
  return prisma.lead.findMany({ where: { merchantId }, orderBy: BOARD_ORDER });
}

/** One below the current top of a column, so the card sorts first. */
async function topPosition(merchantId: string, stage: LeadStage) {
  const top = await prisma.lead.aggregate({
    where: { merchantId, stage },
    _min: { orderPosition: true },
  });
  return (top._min.orderPosition ?? 0) - 1;
}

export async function createLead(args: {
  merchantId: string;
  name: string;
  contact?: string | null;
  note?: string | null;
  stage?: LeadStage;
  tags?: string[];
}) {
  const stage = args.stage ?? "YENI";
  return prisma.lead.create({
    data: {
      merchantId: args.merchantId,
      name: args.name,
      contact: args.contact ?? null,
      note: args.note ?? null,
      stage,
      tags: args.tags ?? [],
      orderPosition: await topPosition(args.merchantId, stage),
    },
  });
}

/** Returns false when the id doesn't belong to this tenant (or is stale). */
export async function moveLead(merchantId: string, leadId: string, stage: LeadStage) {
  const res = await prisma.lead.updateMany({
    where: { id: leadId, merchantId },
    data: { stage, orderPosition: await topPosition(merchantId, stage) },
  });
  return res.count > 0;
}

export async function updateLead(
  merchantId: string,
  leadId: string,
  data: {
    name?: string;
    contact?: string | null;
    note?: string | null;
    tags?: string[];
    stage?: LeadStage;
  }
) {
  const res = await prisma.lead.updateMany({ where: { id: leadId, merchantId }, data });
  return res.count > 0;
}

export async function deleteLead(merchantId: string, leadId: string) {
  const res = await prisma.lead.deleteMany({ where: { id: leadId, merchantId } });
  return res.count > 0;
}
