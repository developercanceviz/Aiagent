import { InboxView } from "@/components/inbox/inbox-view";
import { getInboxConversations } from "@/lib/actions/conversation";

export const dynamic = "force-dynamic";

export default async function MesajlarPage({
  searchParams,
}: {
  searchParams: Promise<{ conversation?: string }>;
}) {
  const conversations = await getInboxConversations();
  const { conversation } = await searchParams;
  return (
    <div className="h-full">
      <InboxView initial={conversations} initialConversationId={conversation} />
    </div>
  );
}
