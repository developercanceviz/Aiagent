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

  it.each([
    "siparişimi iptal etmek istiyorum",
    "İPTAL ETMEK İSTİYORUM",
  ])("files cancellation %j under İADE TALEPLERİ too", (text) => {
    expect(matchIntent(text)?.stage).toBe("IADE_TALEP");
  });

  it.each([
    "adresimi değiştirmek istiyorum",
    "telefon numaramı değiştirebilir miyim",
  ])("does not misfile address/phone change %j as İADE TALEPLERİ", (text) => {
    expect(matchIntent(text)?.stage).not.toBe("IADE_TALEP");
  });
});

describe("product-quality complaint detection", () => {
  it.each([
    "ürünüm ezilmiş geldi",
    "hurmalar kırık gelmiş",
    "paket yırtık ulaştı",
    "ürün bayat geldi",
    "çok kuru gelmiş",
  ])("files arrival complaint %j under İADE TALEPLERİ", (text) => {
    expect(matchIntent(text)?.stage).toBe("IADE_TALEP");
  });

  it.each([
    "yumuşak hurma var mı?",
    "kuru hurma çeşitleriniz neler",
  ])("leaves a plain preference question %j alone", (text) => {
    expect(matchIntent(text)).toBeNull();
  });
});

describe("human-agent request detection", () => {
  it.each([
    "gerçek bir insanla görüşebilir miyim",
    "müşteri temsilcisiyle görüşmek istiyorum",
    "yetkili biriyle görüşmek istiyorum",
  ])("files %j as YENİ", (text) => {
    expect(matchIntent(text)?.stage).toBe("YENI");
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

describe("greeting instruction", () => {
  it("instructs a greeting on the first turn (default)", () => {
    const prompt = buildCustomerPrompt({ storeName: "Test" });
    expect(prompt).toContain("Merhabalar efendim");
    expect(prompt).not.toContain("Yeniden selamlama yapma");
  });

  it("instructs a greeting when isFirstTurn is explicitly true", () => {
    const prompt = buildCustomerPrompt({ storeName: "Test", isFirstTurn: true });
    expect(prompt).toMatch(/ilk yanıtın.*Merhabalar efendim/s);
  });

  it("forbids re-greeting once isFirstTurn is false", () => {
    const prompt = buildCustomerPrompt({ storeName: "Test", isFirstTurn: false });
    expect(prompt).toContain("Yeniden selamlama yapma");
    expect(prompt).not.toMatch(/ilk yanıtın.*Merhabalar efendim/s);
  });
});
