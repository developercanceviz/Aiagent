"use client";

import * as React from "react";
import { ArrowRight, Bot, BookOpen, MessageSquare, Zap } from "lucide-react";

import { cn, formatNumber } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ChannelIcon, type ChannelKind } from "@/components/channel-icon";
import { ConversationAreaChart } from "@/components/charts/conversation-area-chart";
import { ChannelDonut, ChannelLegend } from "@/components/charts/channel-donut";
import { ChannelBarChart } from "@/components/charts/channel-bar-chart";
import { channelStatuses } from "@/lib/mock/dashboard";
import type { DashboardSnapshot } from "@/lib/dashboard/data";

const ranges = ["d1", "d3", "d7", "d15", "d30"] as const;

export function DashboardView({ snapshot }: { snapshot: DashboardSnapshot }) {
  const { t } = useI18n();
  const [range, setRange] = React.useState<(typeof ranges)[number]>("d7");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight">{t.dashboard.title}</h1>
            {!snapshot.live && (
              <Badge variant="outline" className="text-[10px]">
                demo veri
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground">{t.dashboard.subtitle}</p>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-border/60 bg-card p-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                range === r ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.dashboard.ranges[r]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {snapshot.kpis.map((k) => (
          <KpiCard
            key={k.key}
            label={t.dashboard.kpis[k.key]}
            value={typeof k.value === "number" ? formatNumber(k.value) : k.value}
            delta={k.delta}
            positive={k.positive}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>{t.dashboard.conversationPerformance}</CardTitle>
              <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                <Legend color="#14daaa" label={t.dashboard.legendChat} />
                <Legend color="#0084ff" label={t.dashboard.legendAi} />
                <Legend color="#e1306c" label={t.dashboard.legendLive} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ConversationAreaChart data={snapshot.conversationSeries} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.channelDistribution}</CardTitle>
            <p className="text-xs text-muted-foreground">{t.dashboard.channelDistributionSub}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <ChannelDonut data={snapshot.channelDistribution} />
            <ChannelLegend data={snapshot.channelDistribution} />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t.dashboard.channelBasedConversations}</CardTitle>
            <p className="text-xs text-muted-foreground">{t.dashboard.channelBasedSub}</p>
          </CardHeader>
          <CardContent>
            <ChannelBarChart data={snapshot.channelDaily} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.connectedAgents}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.agents.map((agent) => (
              <div key={agent.id} className="flex items-center gap-3 rounded-xl border border-border/60 p-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-ink text-ink-foreground">
                  <Bot className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{agent.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatNumber(agent.conversations)} konuşma
                  </p>
                </div>
                <Badge variant="success">{agent.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.aiPerformance}</CardTitle>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Ort. Yanıt Süresi</p>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">4sn</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Toplam Mesaj</p>
                <p className="text-lg font-semibold">
                  {formatNumber(Number(snapshot.kpis[0]?.value ?? 0))}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">AI Yanıtı</p>
                <p className="text-lg font-semibold">
                  {formatNumber(Number(snapshot.kpis[1]?.value ?? 0))}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.channelStatus}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {channelStatuses.map((c) => (
              <div key={c.type} className="flex items-center gap-3 rounded-xl border border-border/60 p-2.5">
                <ChannelIcon kind={c.type as ChannelKind} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.sub}</p>
                </div>
                <Badge variant="success">{t.dashboard.active}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>{t.dashboard.recentConversations}</CardTitle>
            <button className="text-xs text-muted-foreground hover:text-foreground">
              {t.dashboard.seeAll}
            </button>
          </CardHeader>
          <CardContent className="space-y-1">
            {snapshot.recent.map((c) => (
              <div key={c.name} className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent">
                <Avatar className="size-8">
                  <AvatarFallback className="bg-muted text-foreground">
                    {c.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{c.preview}</p>
                </div>
                <span className="shrink-0 text-[11px] text-muted-foreground">{c.time}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <QuickLink icon={Zap} title={t.dashboard.quickStoreAssistant} href="/asistan" />
        <QuickLink icon={BookOpen} title={t.dashboard.quickKnowledgeBase} href="/bilgi-bankasi" />
        <QuickLink icon={MessageSquare} title={t.dashboard.quickGoToMessages} href="/mesajlar" />
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function QuickLink({ icon: Icon, title, href }: { icon: typeof Zap; title: string; href: string }) {
  return (
    <a
      href={href}
      className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-card transition-colors hover:bg-accent"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-brand-700">
          <Icon className="size-4" />
        </div>
        <span className="text-sm font-medium">{title}</span>
      </div>
      <ArrowRight className="size-4 text-muted-foreground" />
    </a>
  );
}
