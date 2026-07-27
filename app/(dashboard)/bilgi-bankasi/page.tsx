import { BookOpen } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";
import { KnowledgeManager } from "@/components/knowledge/knowledge-manager";
import { getKnowledgeItems } from "@/lib/actions/knowledge";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function BilgiBankasiPage() {
  const t = getDictionary("tr");
  const items = await getKnowledgeItems();
  return (
    <div className="space-y-3">
      <PageHeader icon={BookOpen} title={t.knowledge.title} subtitle={t.knowledge.subtitle} />
      <KnowledgeManager initial={items} />
    </div>
  );
}
