"use client";

import * as React from "react";
import { Archive, Bot, FlaskConical, Hand, MessageCircle, Search, Send, Star } from "lucide-react";

import { cn, relativeTimeTR } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ChannelIcon, type ChannelKind } from "@/components/channel-icon";
import { useConversationsRealtime } from "@/lib/realtime/use-conversations";
import { MessageThread } from "@/components/inbox/message-thread";
import { TestChat } from "@/components/inbox/test-chat";
import {
  CorrectAnswerDialog,
  type CorrectionTarget,
} from "@/components/inbox/correct-answer-dialog";
import { getCorrectedMessageIds } from "@/lib/actions/knowledge";
import {
  getConversationById,
  getInboxConversations,
  getThread,
  sendHumanMessage,
  takeoverConversation,
  returnToAi,
  type InboxConversationDTO,
  type InboxMessageDTO,
} from "@/lib/actions/conversation";

export function InboxView({
  initial,
  initialConversationId,
}: {
  initial: InboxConversationDTO[];
  /** Deep-link target, e.g. opened via "sohbete git" from a CRM lead card. */
  initialConversationId?: string;
}) {
  const { t } = useI18n();
  const [filter, setFilter] = React.useState<
    "all" | "instagram" | "whatsapp" | "live" | "test"
  >("all");
  const [correcting, setCorrecting] = React.useState<CorrectionTarget | null>(null);
  // AI messages that already have a correction, so they aren't corrected twice.
  const [correctedIds, setCorrectedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    getCorrectedMessageIds()
      .then((ids) => setCorrectedIds(new Set(ids)))
      .catch(() => {});
  }, []);
  const [conversations, setConversations] = React.useState(initial);
  const [activeId, setActiveId] = React.useState<string | null>(
    initialConversationId ?? initial[0]?.id ?? null
  );
  const [thread, setThread] = React.useState<InboxMessageDTO[]>([]);
  const [draft, setDraft] = React.useState("");
  const [, startTransition] = React.useTransition();

  // "all"/"test" both mean "no server-side filter" — test conversations are
  // already excluded in listConversations regardless.
  const dbFilter = filter === "all" || filter === "test" ? undefined : filter;
  const refresh = React.useCallback(() => {
    startTransition(async () => setConversations(await getInboxConversations(dbFilter)));
  }, [dbFilter]);
  // A message arriving for the conversation currently open in the thread
  // pane must refetch that thread too — the AI's reply is saved and sent to
  // the customer within seconds, but the pane doesn't observe the DB on its
  // own; it only fetches when `activeId` changes. Without this, a reply to
  // an already-open conversation is real (the customer gets it on
  // Instagram/WhatsApp) but sits invisible here until the merchant clicks
  // away and back — this was read as "the AI answers but it's not showing
  // up in the panel."
  useConversationsRealtime(refresh, (conversationId) => {
    if (conversationId === activeId) {
      getThread(conversationId).then(setThread);
    }
  });

  // Re-fetch from the server whenever the active tab changes. Previously the
  // tabs filtered the single "most recent 100 overall" list client-side —
  // for a low-frequency state like "live" (human-handled), that meant only
  // 1 of 42 such conversations ever showed up, because the other 41 fell
  // outside that shared top-100 window. Each tab now gets its own top-100
  // query scoped to what it actually shows.
  const mounted = React.useRef(false);
  React.useEffect(() => {
    // Skip on mount: `initial` (server-rendered "all") already matches.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (filter === "test") return;
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  React.useEffect(() => {
    if (!activeId) return;
    let alive = true;
    getThread(activeId).then((t) => alive && setThread(t));
    return () => {
      alive = false;
    };
  }, [activeId]);

  // Deep-link target (e.g. "sohbete git" from a CRM lead card) may be older
  // than the inbox's most-recent-100 window, so it might not be in the list
  // this page server-rendered — fetch it directly and splice it in.
  React.useEffect(() => {
    if (!initialConversationId) return;
    if (conversations.some((c) => c.id === initialConversationId)) return;
    let alive = true;
    getConversationById(initialConversationId).then((c) => {
      if (alive && c) setConversations((prev) => [c, ...prev]);
    });
    return () => {
      alive = false;
    };
    // Only ever runs for the deep-link target on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialConversationId]);

  const active = conversations.find((c) => c.id === activeId) ?? null;

  const filters = [
    { key: "all" as const, label: t.messages.filters.all },
    { key: "instagram" as const, label: t.messages.filters.instagram },
    { key: "whatsapp" as const, label: t.messages.filters.whatsapp },
    { key: "live" as const, label: t.messages.filters.live },
    { key: "test" as const, label: t.messages.test.tab, icon: FlaskConical },
  ];
  // conversations is already scoped to the active tab server-side (see
  // refresh/dbFilter above), so no client-side re-filtering here.
  const visible = conversations;

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
          {/* Wraps: five chips don't fit the 320px column on one line. */}
          <div className="flex flex-wrap items-center gap-1">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                  filter === f.key
                    ? "bg-ink text-ink-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {"icon" in f && f.icon && <f.icon className="size-3" />}
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
          {filter === "test" && (
            <div className="m-3 rounded-xl border border-border/60 bg-muted/40 p-3">
              <p className="flex items-center gap-1.5 text-xs font-medium">
                <FlaskConical className="size-3.5" /> {t.messages.test.title}
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {t.messages.test.subtitle}
              </p>
            </div>
          )}
          {filter !== "test" &&
            visible.map((c) => (
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
      {filter === "test" ? (
        <TestChat correctedIds={correctedIds} onCorrect={setCorrecting} />
      ) : active ? (
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

          <MessageThread
            messages={thread}
            conversationId={active.id}
            correctedIds={correctedIds}
            onCorrect={setCorrecting}
          />

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

      <CorrectAnswerDialog
        target={correcting}
        onClose={() => setCorrecting(null)}
        onSaved={(messageId) =>
          setCorrectedIds((prev) => new Set(prev).add(messageId))
        }
      />
    </div>
  );
}
