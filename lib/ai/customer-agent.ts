import { generateText, type CoreMessage } from "ai";

import { getModel } from "@/lib/ai/provider";
import { buildCustomerPrompt } from "@/lib/ai/prompt";
import { buildCustomerTools } from "@/lib/ai/tools/customer-tools";
import { retrieve } from "@/lib/ai/rag";
import { applyIntentRules } from "@/lib/ai/intents";
import { getMerchant, getMerchantAdapter } from "@/lib/db/merchant";
import {
  appendMessage,
  getConversationHistory,
} from "@/lib/db/conversation";
import { prisma } from "@/lib/db/client";
import type { MsgRole } from "@prisma/client";

/**
 * Customer-agent turn pipeline (channel-facing):
 * normalize → history → RAG → assemble prompt → Claude w/ tools → reply →
 * persist + token cost. The streaming Web Chat path (app/api/chat/webchat)
 * reuses prepareAgentRun(); this non-streaming entry point serves the async
 * channel job (Meta/Phase 9).
 */

const roleToCore: Record<MsgRole, "user" | "assistant" | "system"> = {
  CUSTOMER: "user",
  AI: "assistant",
  HUMAN_AGENT: "assistant",
  SYSTEM: "system",
};

export async function prepareAgentRun(args: {
  merchantId: string;
  conversationId: string;
  latestUserText: string;
}) {
  const [merchant, adapter, history, knowledge, corrections] = await Promise.all([
    getMerchant(args.merchantId),
    // A broken store connection must not silence the agent — see
    // buildCustomerTools: it just runs without the commerce tools.
    getMerchantAdapter(args.merchantId).catch((err) => {
      console.error("[agent] commerce adapter unavailable", err);
      return null;
    }),
    getConversationHistory(args.conversationId),
    retrieve(args.merchantId, args.latestUserText, {
      limit: 4,
      // Corrections are fetched separately below so they can be injected with
      // priority instead of competing with documents for the same 4 slots.
      excludeTypes: ["CORRECTION"],
    }).catch(() => []),
    retrieve(args.merchantId, args.latestUserText, {
      limit: 3,
      types: ["CORRECTION"],
      // A correction only applies to the question it was written for; a loose
      // match would override good answers with an unrelated fix.
      minScore: 0.78,
    }).catch(() => []),
    // Runs even if the model never calls captureLead (see lib/ai/intents.ts).
    applyIntentRules({
      merchantId: args.merchantId,
      conversationId: args.conversationId,
      text: args.latestUserText,
    }).catch(() => null),
  ]);

  const system = buildCustomerPrompt({
    storeName: merchant?.storeName ?? "Mağaza",
    knowledge: knowledge.map((k) => `${k.title}: ${k.content}`),
    corrections: corrections.map((c) => ({ question: c.title, answer: c.content })),
  });

  const messages: CoreMessage[] = history.map((m) => ({
    role: roleToCore[m.role],
    content: m.content,
  }));

  const tools = buildCustomerTools({
    merchantId: args.merchantId,
    conversationId: args.conversationId,
    adapter,
  });

  return { system, messages, tools };
}

/**
 * Non-streaming turn used by the async channel job (Meta channels). Returns the
 * reply text so the caller can send it back out through the channel adapter,
 * or null if the agent should stay silent (human takeover / no input).
 */
export async function runCustomerAgentTurn(payload: {
  merchantId: string;
  conversationId: string;
}): Promise<string | null> {
  const last = await prisma.message.findFirst({
    where: { conversationId: payload.conversationId, role: "CUSTOMER" },
    orderBy: { createdAt: "desc" },
  });
  if (!last) return null;

  // If a human has taken over, stay silent.
  const conv = await prisma.conversation.findUnique({
    where: { id: payload.conversationId },
    select: { handledBy: true },
  });
  if (conv?.handledBy === "HUMAN") return null;

  const { system, messages, tools } = await prepareAgentRun({
    merchantId: payload.merchantId,
    conversationId: payload.conversationId,
    latestUserText: last.content,
  });

  const result = await generateText({
    model: getModel("chat"),
    system,
    messages,
    tools,
    maxSteps: 5,
  });

  await appendMessage({
    conversationId: payload.conversationId,
    role: "AI",
    content: result.text,
    tokensIn: result.usage.promptTokens,
    tokensOut: result.usage.completionTokens,
  });

  return result.text;
}
