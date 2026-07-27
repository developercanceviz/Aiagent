import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import type { LeadStage } from "@prisma/client";

export async function listLeads(merchantId: string) {
  if (!isConfigured.database()) return [];
  return prisma.lead.findMany({
    where: { merchantId },
    orderBy: [{ stage: "asc" }, { orderPosition: "asc" }],
  });
}

export async function createLead(args: {
  merchantId: string;
  name: string;
  contact?: string;
  stage?: LeadStage;
  tags?: string[];
}) {
  const count = await prisma.lead.count({
    where: { merchantId: args.merchantId, stage: args.stage ?? "YENI" },
  });
  return prisma.lead.create({
    data: {
      merchantId: args.merchantId,
      name: args.name,
      contact: args.contact,
      stage: args.stage ?? "YENI",
      tags: args.tags ?? [],
      orderPosition: count,
    },
  });
}

export async function moveLead(
  merchantId: string,
  leadId: string,
  stage: LeadStage,
  orderPosition: number
) {
  await prisma.lead.updateMany({
    where: { id: leadId, merchantId },
    data: { stage, orderPosition },
  });
}
