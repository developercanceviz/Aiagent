import { AlertTriangle, ArrowRight, Bot, MessageSquare, Sparkles } from "lucide-react";

import { formatNumber } from "@/lib/utils";
import { getDictionary } from "@/lib/i18n";
import { Badge } from "@/components/ui/badge";
import { ChannelAiToggles } from "@/components/settings/channel-ai-toggles";
import { connectedAgents } from "@/lib/mock/dashboard";
import { demoStore } from "@/lib/config/brand";
import { getChannelSettings } from "@/lib/actions/channel";

// Channel AI state is live data — never serve it from the build cache.
export const dynamic = "force-dynamic";

export default async function AiAgentSettingsPage() {
  const t = getDictionary("tr");
  const tt = t.settings.aiAgentPage;
  const channels = await getChannelSettings();

  return (
    <div className="space-y-3">
      {/* Request banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ink p-5 text-ink-foreground">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-primary">
            <Sparkles className="size-5" />
          </div>
          <div>
            <p className="font-semibold">{tt.requestTitle}</p>
            <p className="text-sm text-white/60">{tt.requestSubtitle}</p>
          </div>
        </div>
        <button className="flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-600">
          {tt.requestCta}
          <ArrowRight className="size-4" />
        </button>
      </div>

      {/* Your agents */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">
            {tt.yourAgents}
          </p>
          <span className="rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">
            {connectedAgents.length}
          </span>
        </div>
        {connectedAgents.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-ink text-ink-foreground">
              <Bot className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold">{a.name}</p>
                <Badge variant="success">● {tt.active}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{demoStore.agentId}</p>
            </div>
            <div className="ml-auto flex items-center gap-5 text-sm">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="size-4" />
                <b className="text-foreground">{formatNumber(a.conversations)}</b>{" "}
                {tt.conversations}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Sparkles className="size-4" />
                <b className="text-foreground">{formatNumber(a.messages)}</b>{" "}
                {tt.messagesCount}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Channel AI control — real Channel.aiEnabled state */}
      <div className="rounded-2xl border border-border/60 bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3.5">
          <p className="text-xs font-semibold tracking-wide text-muted-foreground">
            {tt.channelAiControl}
          </p>
          <span className="rounded-md bg-muted px-1.5 text-[11px] text-muted-foreground">
            {channels.length}
          </span>
        </div>
        <div className="flex items-start gap-2 border-b border-border/60 bg-amber-50 px-5 py-3 text-xs text-amber-900">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          {tt.channelAiWarning}
        </div>
        <ChannelAiToggles channels={channels} />
      </div>
    </div>
  );
}
