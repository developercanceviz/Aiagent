import { describe, expect, it } from "vitest";

import { matchIntent } from "@/lib/ai/intents";
import { buildCustomerPrompt } from "@/lib/ai/prompt";

describe("iade intent detection", () => {
  it.each([
    "iade yapmak istiyorum",
    "İade işlemleri nasıl oluyor?",
    "ürünü iademi edebilirim",
    "bunu değiştirmek istiyorum",
    "değişim yapabilir miyim",
    "geri göndermek istiyorum",
    "iade talebi oluşturmak istiyorum",
    "İADE ETMEK İSTİYORUM",
    "IADE YAPMAK ISTIYORUM",
  ])("files %j under İADE TALEPLERİ", (text) => {
    expect(matchIntent(text)?.stage).toBe("IADE_TALEP");
  });

  it.each([
    "5 kilo hurma ne kadar?",
    "kargo ne zaman gelir",
    "siparişim nerede",
    "stokta var mı",
  ])("leaves ordinary message %j alone", (text) => {
    expect(matchIntent(text)).toBeNull();
  });
});

describe("corrections in the customer prompt", () => {
  const corrections = [
    { question: "Kapıda ödeme var mı?", answer: "Kapıda ödeme yok." },
  ];

  it("injects the reviewed answer", () => {
    const prompt = buildCustomerPrompt({ storeName: "Test", corrections });
    expect(prompt).toContain("Kapıda ödeme yok.");
    expect(prompt).toContain("ONAYLANMIŞ DÜZELTMELER");
  });

  it("puts corrections ahead of the knowledge base so they win a conflict", () => {
    const prompt = buildCustomerPrompt({
      storeName: "Test",
      corrections,
      knowledge: ["SSS: Kapıda ödeme yapılabilir"],
    });
    expect(prompt.indexOf("ONAYLANMIŞ DÜZELTMELER")).toBeLessThan(
      prompt.indexOf("BİLGİ BANKASI")
    );
  });

  it("omits the section entirely when there is nothing to correct", () => {
    expect(buildCustomerPrompt({ storeName: "Test" })).not.toContain(
      "ONAYLANMIŞ DÜZELTMELER"
    );
  });
});
