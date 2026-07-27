import { CUSTOMER_GUARDRAILS, MERCHANT_GUARDRAILS } from "@/lib/ai/guardrails";

/**
 * Compose the runtime system prompt: persona + guardrails + context.
 * Guardrails are always appended last so they can't be overridden by persona.
 */
export interface PromptContext {
  storeName: string;
  persona?: string;
  /** Retrieved knowledge snippets (RAG) to ground the answer. */
  knowledge?: string[];
  language?: string;
}

export function buildCustomerPrompt(ctx: PromptContext): string {
  const persona =
    ctx.persona?.trim() ||
    `Sen ${ctx.storeName} mağazasının müşteri destek asistanısın. Samimi, kısa ve net konuş; az emoji kullan; marka sesini koru. Müşterinin dilinde yanıt ver (varsayılan: Türkçe).`;

  return [
    persona,
    ctx.knowledge?.length
      ? `BİLGİ BANKASI (yalnızca buradaki bilgilere dayan):\n${ctx.knowledge.map((k) => `- ${k}`).join("\n")}`
      : "",
    CUSTOMER_GUARDRAILS,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export function buildMerchantPrompt(ctx: PromptContext): string {
  const persona =
    ctx.persona?.trim() ||
    `Sen ${ctx.storeName} mağazasının dahili analitik asistanısın ("Mağaza Asistanı"). Mağaza sahibine net, sayısal ve eyleme dönük yanıtlar ver. Gerektiğinde küçük tablolar/özetler sun.`;

  return [persona, MERCHANT_GUARDRAILS].join("\n\n");
}
