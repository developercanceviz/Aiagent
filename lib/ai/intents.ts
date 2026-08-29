import { prisma } from "@/lib/db/client";
import { isConfigured } from "@/lib/config/env";
import { logEvent } from "@/lib/db/audit";
import type { LeadStage } from "@prisma/client";

/**
 * Intent rules: customer messages that should land in the CRM by themselves,
 * regardless of what the agent decides to say back.
 *
 * The agent also has a captureLead tool and is told to use it, but a model can
 * forget a tool call — and a missed return request is a lost customer. This
 * runs on the raw inbound text on every turn, so the rule holds even if the
 * model does nothing. Both paths converge on the same upsert (keyed by
 * conversationId), so they can't produce duplicate leads.
 *
 * More intents (kargo sorunu, toptan talebi, …) get added here as columns for
 * them appear.
 */

export interface IntentRule {
  key: string;
  /** Where a matching conversation is filed on the CRM board. */
  stage: LeadStage;
  /** Matched against Turkish-normalised, lower-cased text. */
  test: RegExp;
  /** Note written on the lead so the reason is visible on the card. */
  note: string;
}

/**
 * Turkish case folding, which JavaScript's /i flag does not do: "İade" and
 * "IADE" both have to reach "iade" or a customer writing normally (or in caps)
 * is missed. Both dotted and dotless capitals fold to "i" here — over-matching
 * an "ı" word is harmless for these patterns, missing a return request is not.
 */
export function normalizeTr(text: string): string {
  return text.replace(/[İI]/g, "i").toLocaleLowerCase("tr");
}

export const INTENT_RULES: IntentRule[] = [
  {
    key: "iade",
    stage: "IADE_TALEP",
    // Turkish is agglutinative: iade / iadesi / iademi / iadeyi share the stem,
    // so a stem match beats an exact-word one. "değişim/değiştir" covers
    // exchange requests, which the merchant handles through the same process.
    test: /iade|değiş(im|tir|ecek|ebilir)|geri\s*(gönder|iade|ödeme|göndermek)/,
    note: "İade/değişim talebi — sohbette otomatik algılandı.",
  },
];

export function matchIntent(text: string): IntentRule | null {
  const normalized = normalizeTr(text);
  return INTENT_RULES.find((r) => r.test.test(normalized)) ?? null;
}

/**
 * Files the conversation as a lead in the intent's column. Idempotent: a
 * conversation already filed under the same stage is left alone, so a customer
 * repeating "iade" doesn't churn the card back to the top of the column.
 */
export async function applyIntentRules(args: {
  merchantId: string;
  conversationId: string;
  text: string;
}): Promise<IntentRule | null> {
  if (!isConfigured.database()) return null;
  const rule = matchIntent(args.text);
  if (!rule) return null;

  const [conversation, existing] = await Promise.all([
    prisma.conversation.findUnique({
      where: { id: args.conversationId },
      select: { customerName: true, customerExtId: true, merchantId: true },
    }),
    prisma.lead.findUnique({
      where: { conversationId: args.conversationId },
      select: { id: true, stage: true },
    }),
  ]);
  if (!conversation || conversation.merchantId !== args.merchantId) return null;
  if (existing?.stage === rule.stage) return rule;

  if (existing) {
    await prisma.lead.update({
      where: { id: existing.id },
      data: { stage: rule.stage, orderPosition: await topPosition(args.merchantId, rule.stage) },
    });
  } else {
    await prisma.lead.create({
      data: {
        merchantId: args.merchantId,
        conversationId: args.conversationId,
        name: conversation.customerName?.trim() || "İade talebi",
        contact: conversation.customerExtId,
        stage: rule.stage,
        note: rule.note,
        orderPosition: await topPosition(args.merchantId, rule.stage),
      },
    });
  }

  await logEvent({
    merchantId: args.merchantId,
    conversationId: args.conversationId,
    type: "lead.intent",
    data: { intent: rule.key, stage: rule.stage },
  }).catch(() => {});

  return rule;
}

/** Mirrors lib/db/lead.ts — a filed lead sorts to the top of its column. */
async function topPosition(merchantId: string, stage: LeadStage) {
  const top = await prisma.lead.aggregate({
    where: { merchantId, stage },
    _min: { orderPosition: true },
  });
  return (top._min.orderPosition ?? 0) - 1;
}
