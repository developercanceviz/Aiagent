import { CrmBoard } from "@/components/kanban/crm-board";
import { getLeads } from "@/lib/actions/lead";

export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const leads = await getLeads();
  return (
    <div className="h-full">
      <CrmBoard initial={leads} />
    </div>
  );
}
