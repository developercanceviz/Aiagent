import { Info, Megaphone, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { getAnnouncements } from "@/lib/actions/announcement";
import { getDictionary } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function DuyurularPage() {
  const t = getDictionary("tr");
  const announcements = await getAnnouncements();

  return (
    <div className="space-y-3">
      <PageHeader icon={Megaphone} title={t.announcements.title} />

      <div className="mx-auto max-w-3xl space-y-4 pt-2">
        <div className="flex items-center gap-2">
          <Megaphone className="size-5 text-violet-600" />
          <h2 className="text-lg font-semibold">{t.announcements.headerTitle}</h2>
        </div>
        <p className="-mt-2 text-sm text-muted-foreground">{t.announcements.subtitle}</p>

        {announcements.map((a) => (
          <article
            key={a.id}
            className={
              a.badge
                ? "rounded-2xl border border-violet-100 bg-violet-50/50 p-5"
                : "rounded-2xl border border-border/60 bg-card p-5 shadow-card"
            }
          >
            <div className="flex gap-4">
              <div
                className={
                  a.badge
                    ? "flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-violet-600 shadow-sm"
                    : "flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600"
                }
              >
                {a.badge ? <Zap className="size-5" /> : <Info className="size-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  {a.badge && <Badge variant="feature">{a.badge}</Badge>}
                  <span className="text-xs text-muted-foreground">{a.date}</span>
                </div>
                <h3 className="mt-1.5 text-base font-semibold">{a.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
