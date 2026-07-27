/**
 * Phase 0 placeholder data so the UI is reviewable before the ikas adapter
 * (Phase 1) and conversation tables (Phase 6) feed it real numbers.
 * Everything here is replaced by `IkasAdapter.getSalesSummary` + DB queries.
 */

export const kpis = [
  { key: "totalConversations", value: 461, delta: -24, positive: false },
  { key: "aiReplies", value: 25, delta: -96, positive: false },
  { key: "liveSupport", value: 0, delta: -100, positive: false },
  { key: "avgResponseTime", value: "4sn", delta: 0, positive: true },
] as const;

export const conversationSeries = [
  { day: "10 Haz", sohbet: 78, ai: 12, canli: 3 },
  { day: "11 Haz", sohbet: 64, ai: 9, canli: 2 },
  { day: "12 Haz", sohbet: 52, ai: 7, canli: 1 },
  { day: "13 Haz", sohbet: 58, ai: 6, canli: 0 },
  { day: "14 Haz", sohbet: 71, ai: 8, canli: 2 },
  { day: "15 Haz", sohbet: 66, ai: 5, canli: 1 },
  { day: "16 Haz", sohbet: 72, ai: 4, canli: 0 },
];

export const channelDistribution = [
  { name: "Instagram", value: 268, color: "var(--color-instagram)" },
  { name: "Messenger", value: 92, color: "var(--color-messenger)" },
  { name: "Webchat", value: 61, color: "var(--color-webchat)" },
  { name: "WhatsApp", value: 40, color: "var(--color-whatsapp)" },
];

export const channelDaily = [
  { day: "10 Haz", instagram: 42, messenger: 14, whatsapp: 8, webchat: 10 },
  { day: "11 Haz", instagram: 30, messenger: 10, whatsapp: 6, webchat: 8 },
  { day: "12 Haz", instagram: 22, messenger: 8, whatsapp: 4, webchat: 6 },
  { day: "13 Haz", instagram: 28, messenger: 9, whatsapp: 5, webchat: 7 },
  { day: "14 Haz", instagram: 36, messenger: 12, whatsapp: 7, webchat: 9 },
  { day: "15 Haz", instagram: 31, messenger: 10, whatsapp: 6, webchat: 8 },
  { day: "16 Haz", instagram: 34, messenger: 11, whatsapp: 7, webchat: 9 },
];

export const connectedAgents = [
  {
    id: "agn_305a7474c6",
    name: "Can Ceviz Müşteri Destek Asistanı",
    status: "AKTİF",
    conversations: 5839,
    messages: 11688,
  },
];

export const channelStatuses = [
  { type: "instagram", name: "Instagram", sub: "@canceviz_hurma · Can Ceviz Müşteri Destek Asistanı", active: true },
  { type: "whatsapp", name: "WhatsApp", sub: "+90 553 522 98 95 · Can Ceviz Müşteri Destek Asistanı", active: true },
  { type: "messenger", name: "Messenger", sub: "Canceviz hurma · Can Ceviz Müşteri Destek Asistanı", active: true },
] as const;

export const recentConversations = [
  { name: "mirac mirac mirac", preview: "Merhaba, hayır paylaşımlarınızın başına…", time: "10 dk", channel: "instagram" },
  { name: "Ayfer Acar Şenal", preview: "Kayıs kurusu tekrar gelecekmiş acaba", time: "34 dk", channel: "whatsapp" },
  { name: "Ramazan İnci", preview: "Merhabalar yeniniz nerede, sizde sipariş…", time: "1 sa", channel: "instagram" },
  { name: "Zeynep muharrem", preview: "Kapıdan ödemeniz…", time: "1 sa", channel: "messenger" },
] as const;
