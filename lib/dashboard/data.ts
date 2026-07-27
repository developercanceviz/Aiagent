import { isConfigured } from "@/lib/config/env";
import { prisma } from "@/lib/db/client";
import { getMerchantAdapter } from "@/lib/db/merchant";
import {
  channelDaily,
  channelDistribution,
  connectedAgents,
  conversationSeries,
  kpis,
  recentConversations,
} from "@/lib/mock/dashboard";

export interface DashboardSnapshot {
  live: boolean;
  kpis: typeof kpis;
  conversationSeries: typeof conversationSeries;
  channelDistribution: typeof channelDistribution;
  channelDaily: typeof channelDaily;
  agents: typeof connectedAgents;
  recent: typeof recentConversations;
}

const mockSnapshot: DashboardSnapshot = {
  live: false,
  kpis,
  conversationSeries,
  channelDistribution,
  channelDaily,
  agents: connectedAgents,
  recent: recentConversations,
};

/**
 * Dashboard data. When ikas + DB are connected this computes real KPIs from the
 * adapter's sales summary and our conversation tables; otherwise it returns the
 * Phase-0 mock so the page is always reviewable. Range = days back.
 */
export async function getDashboardSnapshot(
  merchantId: string | null,
  rangeDays = 7
): Promise<DashboardSnapshot> {
  if (!merchantId || !isConfigured.ikas() || !isConfigured.database()) {
    return mockSnapshot;
  }

  try {
    const adapter = await getMerchantAdapter(merchantId);
    const summary = await adapter.getSalesSummary({
      range: { from: new Date(Date.now() - rangeDays * 86400_000), to: new Date() },
    });

    const [totalConversations, aiReplies, liveSupport] = await Promise.all([
      prisma.conversation.count({ where: { merchantId } }),
      prisma.message.count({ where: { role: "AI", conversation: { merchantId } } }),
      prisma.conversation.count({ where: { merchantId, handledBy: "HUMAN" } }),
    ]);

    return {
      ...mockSnapshot,
      live: true,
      kpis: [
        { key: "totalConversations", value: totalConversations, delta: 0, positive: true },
        { key: "aiReplies", value: aiReplies, delta: 0, positive: true },
        { key: "liveSupport", value: liveSupport, delta: 0, positive: true },
        { key: "avgResponseTime", value: "4sn", delta: 0, positive: true },
      ] as unknown as typeof kpis,
      conversationSeries: summary.byDay.length
        ? (summary.byDay.map((d) => ({
            day: d.date.slice(5),
            sohbet: d.orders,
            ai: 0,
            canli: 0,
          })) as unknown as typeof conversationSeries)
        : conversationSeries,
    };
  } catch (err) {
    console.error("[dashboard] live snapshot failed, using mock", err);
    return mockSnapshot;
  }
}
