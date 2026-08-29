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
  /**
   * Merchant-reviewed fixes for answers the agent previously got wrong. These
   * outrank everything else: the store owner typed them by hand after seeing
   * the bad answer, so they are the final word on those questions.
   */
  corrections?: { question: string; answer: string }[];
  language?: string;
}

/**
 * Store workflow rules (distinct from guardrails, which are about safety).
 * A server-side rule files the same lead even if the model skips the tool —
 * see lib/ai/intents.ts — but asking for the tool call gives a better name and
 * summary on the CRM card than the fallback can infer.
 */
const BUSINESS_RULES = [
  "İŞ KURALLARI:",
  "- Müşteri iade, değişim veya geri ödeme talebinden söz ederse: konuyu iade politikasına göre",
  "  yanıtla, gerekiyorsa sipariş numarasını iste ve captureLead aracını category='iade' ile çağır.",
  "  Müşterinin adını bilmiyorsan name='İade talebi' gönder. Bunu müşteriye söyleme, sohbeti normal sürdür.",
].join("\n");

export function buildCustomerPrompt(ctx: PromptContext): string {
  const persona =
    ctx.persona?.trim() ||
    `Sen ${ctx.storeName} mağazasının müşteri destek asistanısın. Samimi, kısa ve net konuş; az emoji kullan; marka sesini koru. Müşterinin dilinde yanıt ver (varsayılan: Türkçe).`;

  return [
    persona,
    ctx.corrections?.length
      ? [
          "ONAYLANMIŞ DÜZELTMELER — EN YÜKSEK ÖNCELİK.",
          "Mağaza sahibi bu soruların doğru yanıtlarını elle onayladı. Aşağıdaki bir madde",
          "soruyla ilgiliyse, bilgi bankası veya kendi bilgin farklı olsa bile MUTLAKA bu",
          "yanıtı esas al ve kendi cümlelerinle aktar:",
          ...ctx.corrections.map(
            (c) => `- Soru: ${c.question}\n  Doğru yanıt: ${c.answer}`
          ),
        ].join("\n")
      : "",
    ctx.knowledge?.length
      ? `BİLGİ BANKASI (yalnızca buradaki bilgilere dayan):\n${ctx.knowledge.map((k) => `- ${k}`).join("\n")}`
      : "",
    BUSINESS_RULES,
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
