import { describe, expect, it } from "vitest";

import {
  CUSTOMER_GUARDRAILS,
  SAFE_TECH_DISCLOSURE_ANSWER_TR,
} from "@/lib/ai/guardrails";
import { buildCustomerPrompt, buildMerchantPrompt } from "@/lib/ai/prompt";

describe("AI guardrails", () => {
  it("includes the safe tech-disclosure answer verbatim", () => {
    expect(CUSTOMER_GUARDRAILS).toContain(SAFE_TECH_DISCLOSURE_ANSWER_TR);
  });

  it("the canned answer refuses to disclose internals", () => {
    expect(SAFE_TECH_DISCLOSURE_ANSWER_TR.toLowerCase()).toContain("güvenli");
    expect(SAFE_TECH_DISCLOSURE_ANSWER_TR).toMatch(/salt-okunur|ödeme/);
  });

  it("appends guardrails after the persona so they can't be overridden", () => {
    const prompt = buildCustomerPrompt({ storeName: "Test", persona: "Persona X" });
    expect(prompt.indexOf("Persona X")).toBeLessThan(prompt.indexOf(CUSTOMER_GUARDRAILS));
  });

  it("grounds the customer prompt in provided knowledge", () => {
    const prompt = buildCustomerPrompt({
      storeName: "Test",
      knowledge: ["İade politikası: 14 gün"],
    });
    expect(prompt).toContain("İade politikası: 14 gün");
  });

  it("merchant prompt carries merchant guardrails", () => {
    expect(buildMerchantPrompt({ storeName: "Test" })).toMatch(/GÜVENLİK/);
  });
});
