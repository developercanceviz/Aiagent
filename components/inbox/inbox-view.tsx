"use client";

import * as React from "react";
import { Archive, Bot, Hand, MessageCircle, Search, Send, Star } from "lucide-react";

import { cn, relativeTimeTR } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChannelIcon, type ChannelKind } from "@/components/channel-icon";
import { useConversationsRealtime } from "@/lib/realtime/use-conversations";
import {
  getInboxConversations,
  getThread,
  sendHumanMessage,
  takeoverConversation,
  returnToAi,
  type InboxConversationDTO,
  type InboxMessageDTO,
} from "@/lib/actions/conversation";

export function InboxView({ initial }: { initial: InboxConversationDTO[] }) {
  const { t } = useI18n();
  const [filter, setFilter] = React.useState<"all" | "instagram" | "whatsapp" | "live">("all");
  const [conversations, setConversations] = React.useState(initial);
  const [activeId, setActiveId] = React.useState<string | null>(initial[0]?.id ?? null);
  const [thread, setThread] = React.useState<InboxMessageDTO[]>([]);
  const [draft, setDraft] = React.useState("");
  const [, startTransition] = React.useTransition();

  const refresh = React.useCallback(() => {
    startTransition(async () => setConversations(await getInboxConversations()));
  }, []);
  useConversationsRealtime(refresh);

  React.useEffect(() => {
    if (!activeId) return;
    let alive = true;
    getThread(activeId).then((t) => alive && setThread(t));
    return () => {
      alive = false;
    };
  }, [activeId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const filters = [
    { key: "all" as const, label: t.messages.filters.all },
    { key: "instagram" as const, label: t.messages.filters.instagram },
    { key: "whatsapp" as const, label: t.messages.filters.whatsapp },
    { key: "live" as const, label: t.messages.filters.live },
  ];
  const visible = conversations.filter((c) =>
    filter === "all" ? true : filter === "live" ? c.handledBy === "HUMAN" : c.channel === filter
  );

  const send = () => {
    if (!draft.trim() || !active) return;
    const text = draft;
    setThread((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "HUMAN_AGENT", content: text, createdAt: new Date().toISOString() },
    ]);
    setDraft("");
    startTransition(() => sendHumanMessage(active.id, text).catch(() => {}));
  };

  const toggleTakeover = () => {
    if (!active) return;
    const toHuman = active.handledBy === "AI";
    setConversations((prev) =>
      prev.map((c) => (c.id === active.id ? { ...c, handledBy: toHuman ? "HUMAN" : "AI" } : c))
    );
    startTransition(() =>
      (toHuman ? takeoverConversation(active.id) : returnToAi(active.id)).catch(() => {})
    );
  };

  return (
    <div className="flex h-full overflow-hidden rounded-2xl border border-border/60 bg-card shadow-card">
      {/* List */}
      <div className="flex w-80 shrink-0 flex-col border-r border-border/60">
        <div className="space-y-3 border-b border-border/60 p-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={t.messages.searchPlaceholder} className="bg-muted pl-9" />
          </div>
          <div className="flex items-center gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key ? "bg-ink text-ink-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <button className="flex items-center gap-1 hover:text-foreground">
              <Star className="size-3.5" /> {t.messages.starred}
            </button>
            <button className="flex items-center gap-1 hover:text-foreground">
              <Archive className="size-3.5" /> {t.messages.archived}
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {visible.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveId(c.id)}
              className={cn(
                "flex w-full items-center gap-3 border-b border-border/40 px-3 py-3 text-left transition-colors hover:bg-accent",
                c.id === activeId && "bg-accent/60"
              )}
            >
              <div className="relative">
                <Avatar className="size-9">
                  <AvatarFallback className="bg-muted text-foreground">
                    {c.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <ChannelIcon
                  kind={c.channel as ChannelKind}
                  size="sm"
                  className="absolute -bottom-1 -right-1 size-4 rounded-full ring-2 ring-card"
                />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{c.name}</p>
                <p className="truncate text-xs text-muted-foreground">{c.preview || "—"}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-[11px] text-muted-foreground">
                  {c.time.includes("T") ? relativeTimeTR(c.time) : c.time}
                </span>
                {c.unread > 0 && (
                  <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                    {c.unread}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Thread */}
      {active ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-9">
                <AvatarFallback className="bg-muted text-foreground">
                  {active.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{active.name}</p>
                <p className="text-xs text-muted-foreground">
                  {active.handledBy === "AI" ? (
                    <span className="flex items-center gap-1">
                      <Bot className="size-3" /> {t.messages.aiHandling}
                    </span>
                  ) : (
                    "Canlı Destek"
                  )}
                </p>
              </div>
            </div>
            <button
              onClick={toggleTakeover}
              className={cn(
                "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors",
                active.handledBy === "AI"
                  ? "bg-ink text-ink-foreground hover:bg-ink/90"
                  : "border border-border text-foreground hover:bg-accent"
              )}
            >
              <Hand className="size-3.5" />
              {active.handledBy === "AI" ? t.messages.takeover : "AI'a Devret"}
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            {thread.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.role === "CUSTOMER" ? "justify-start" : "justify-end")}
              >
                <div
                  className={cn(
                    "max-w-[70%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
                    m.role === "CUSTOMER"
                      ? "bg-muted text-foreground"
                      : m.role === "AI"
                        ? "bg-sky-50 text-foreground"
                        : "bg-primary text-primary-foreground"
                  )}
                >
                  {m.role === "AI" && (
                    <span className="mb-0.5 flex items-center gap-1 text-[10px] text-sky-600">
                      <Bot className="size-3" /> AI
                    </span>
                  )}
                  {m.content}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-border/60 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-3.5 py-2 focus-within:ring-2 focus-within:ring-ring">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Bir mesaj yazın…"
                className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={send}
                disabled={!draft.trim()}
                className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              >
                <Send className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <MessageCircle className="size-6" />
          </div>
          <div>
            <p className="font-medium">{t.messages.emptyTitle}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">{t.messages.emptySubtitle}</p>
          </div>
        </div>
      )}
    </div>
  );
}
