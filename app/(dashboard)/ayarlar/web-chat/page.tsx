import { getWidgetSettings } from "@/lib/actions/widget";
import { WebChatSettings } from "./web-chat-settings";

// Widget visibility is live data — never serve it from the build cache.
export const dynamic = "force-dynamic";

export default async function WebChatSettingsPage() {
  const settings = await getWidgetSettings();
  return <WebChatSettings settings={settings} />;
}
