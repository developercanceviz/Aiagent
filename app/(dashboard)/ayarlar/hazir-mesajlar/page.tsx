"use client";

import { Plus, Search, Zap } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";

export default function HazirMesajlarPage() {
  const { t } = useI18n();
  const tt = t.settings.quickRepliesPage;

  return (
    <div className="space-y-4">
      <PageHeader icon={Zap} title={tt.title} subtitle={tt.subtitle} />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-brand-700">
            <Zap className="size-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">{tt.heading}</h2>
            <p className="max-w-xl text-sm text-muted-foreground">
              {tt.description}
            </p>
          </div>
        </div>
        <Button>
          <Plus className="size-4" /> {tt.add}
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={tt.searchPlaceholder}
          className="h-12 bg-card pl-11 text-base"
        />
      </div>

      <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card py-20 text-center shadow-card">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Zap className="size-6" />
        </div>
        <p className="text-lg font-semibold">{tt.emptyTitle}</p>
        <p className="text-sm text-muted-foreground">{tt.emptySubtitle}</p>
      </div>
    </div>
  );
}
