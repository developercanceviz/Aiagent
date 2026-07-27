import { getCurrentMerchantId } from "@/lib/auth/session";
import { getDashboardSnapshot } from "@/lib/dashboard/data";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const merchantId = await getCurrentMerchantId().catch(() => null);
  const snapshot = await getDashboardSnapshot(merchantId);
  return <DashboardView snapshot={snapshot} />;
}
