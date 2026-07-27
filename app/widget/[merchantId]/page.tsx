import { getWidgetConfig } from "@/lib/db/widget";
import { LiveWidget } from "./live-widget";

export const dynamic = "force-dynamic";

/**
 * Standalone embeddable Web Chat surface (rendered inside the widget iframe the
 * store embeds via /widget.js). Outside the (dashboard) group, so it has no
 * sidebar/topbar — just the chat.
 */
export default async function WidgetPage({
  params,
}: {
  params: Promise<{ merchantId: string }>;
}) {
  const { merchantId } = await params;
  const config = await getWidgetConfig(merchantId);
  return <LiveWidget merchantId={merchantId} config={config} />;
}
