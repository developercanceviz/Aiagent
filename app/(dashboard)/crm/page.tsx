import { CrmBoard } from "@/components/kanban/crm-board";
import { getLeadBoard } from "@/lib/actions/lead";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const state = await getLeadBoard();
  return (
    <div className="h-full">
      <CrmBoard state={state} />
    </div>
  );
}
