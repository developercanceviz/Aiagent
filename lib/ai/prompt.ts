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
 * Sourced from the merchant's "AI Mesajlaşma Eğitim Dokümanı" (living
 * document — re-uploaded to the knowledge base as it grows; see
 * lib/ai/rag.ts). This section carries only the rules that must hold on
 * every single turn regardless of retrieval; the doc's full scenario-by-
 * scenario scripts (exact opening lines, info-collection order, edge cases)
 * live in the knowledge base and reach the model via searchKnowledge /
 * BİLGİ BANKASI instead, so this block stays short.
 *
 * A server-side rule files the same lead even if the model skips the tool —
 * see lib/ai/intents.ts — but asking for the tool call gives a better name and
 * summary on the CRM card than the fallback can infer.
 */
const BUSINESS_RULES = [
  "İŞ KURALLARI:",
  "- Karşılama: konuşmadaki İLK yanıtın 'Merhabalar efendim.' ile başlamalı. Devam eden sohbette",
  "  tekrar selamlama yapma, soruya doğrudan cevap ver.",
  "- Müşterinin daha önce verdiği bilgiyi (ad, sipariş no, sebep vb.) tekrar sorma.",
  "- İndirim oranı, ücret iadesi zamanı, kesin teslimat tarihi ve stok konusunda doğrulanmamış söz verme;",
  "  'hemen dönüş yapılacak' gibi kesin zaman ifadesi kullanma. Mesai dışı gelen taleplerde müşteri",
  "  temsilcisinin mesai saatleri içinde döneceğini belirt.",
  "- Soruya güvenilir ve net bir cevap veremiyorsan tahmin yürütme; şu cümleyle kapat: 'Sorunuzu müşteri",
  "  temsilcimize ilettim. Mesai saatleri içinde size dönüş yapacak.' ve captureLead'i category='genel' ile çağır.",
  "- Sabit gerçekler (bilgi bankasında çelişki olsa bile bunlar geçerlidir): kapıda ödeme YOKTUR; kredi",
  "  kartına taksit YAPILMAZ; havale/EFT açıklamasına sipariş numarası yazılmalıdır; mağaza adresi Fevziçakmak",
  "  Mahallesi'ndedir (eski Aziziye adresini asla paylaşma); toptan satış talepleri Sadi Bey'e yönlendirilir",
  "  ('toptan alım yapıyoruz' değil, 'toptan satışımız bulunmaktadır' de).",
  "- captureLead aracını şu kategorilerle çağır — kategoriye göre CRM sütunu kod tarafında belirlenir, sen",
  "  yalnızca kategoriyi seç:",
  "  · category='iade' → iade/değişim/geri ödeme talebi, sipariş iptali, veya üründe kalite/hasar şikayeti",
  "    (bayat, ekşi, kuru, ezilmiş, kırık, paket yırtık/açık geldi).",
  "  · category='takip' → mevcut bir siparişin kargo/teslimat takibi, adres veya telefon değişikliği,",
  "    e-fatura/kurumsal fatura sorunu, ödeme dekontu kontrolü.",
  "  · category='genel' → yukarıdakilerin dışında insan desteği gereken her durum (gerçek kişiyle görüşme",
  "    talebi, toptan satış geri dönüş talebi, sipariş oluşturamama, mağaza bulunamıyor, iş birliği/form",
  "    takibi, site/sipariş ekranı sorunu).",
  "  Müşterinin adını bilmiyorsan name alanına konuyu özetleyen kısa bir başlık gönder (ör. 'İade talebi',",
  "  'Toptan satış talebi'). Bunu müşteriye söyleme, sohbeti normal sürdür.",
  "- Aynı müşteri ve aynı konu için birden fazla lead oluşturma (captureLead conversationId'ye göre günceller,",
  "  tekrar çağırmak sorun değildir).",
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
