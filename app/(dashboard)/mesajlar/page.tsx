import { InboxView } from "@/components/inbox/inbox-view";
import { getInboxConversations } from "@/lib/actions/conversation";

export const dynamic = "force-dynamic";

export default async function MesajlarPage() {
  const conversations = await getInboxConversations();
  return (
    <div className="h-full">
      <InboxView initial={conversations} />
    </div>
  );
}
