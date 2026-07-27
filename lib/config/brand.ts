/**
 * Agency / platform brand config. Intentionally NOT hardcoded as "Creato" —
 * rebrand by editing these values (or wiring them to per-tenant settings later).
 */
export const brandConfig = {
  name: "Canceviz AI",
  productName: "Canceviz AI Agent",
  wordmark: "CANCEVIZ AI",
};

/**
 * The currently-signed-in demo store. In Phase 1 this is replaced by the
 * authenticated ikas merchant context (Iron Session + Supabase Auth).
 */
export const demoStore = {
  storeName: "Canceviz Hurma",
  handle: "cancevizhurma",
  domain: "cancevizhurma.myikas.com",
  instagram: "@canceviz_hurma",
  agentId: "agn_305a7474c6",
  agentName: "Can Ceviz Müşteri Destek Asistanı",
};
