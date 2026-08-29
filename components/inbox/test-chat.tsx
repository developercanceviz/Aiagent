"use client";

import * as React from "react";
import { AlertTriangle, Loader2, Play, RotateCcw, Send } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon, type ChannelKind } from "@/components/channel-icon";
import { MessageThread } from "@/components/inbox/message-thread";
import type { CorrectionTarget } from "@/components/inbox/correct-answer-dialog";
import {
  getTestChat,
  resetTestChat,
  sendTestMessage,
  startTestChat,
  type TestChannel,
} from "@/lib/actions/test-chat";
import type { InboxMessageDTO } from "@/lib/actions/conversation";

const CHANNELS: { key: TestChannel; icon: ChannelKind; label: string }[] = [
  { key: "WEBCHAT", icon: "webchat", label: "Web Chat" },
  { key: "INSTAGRAM", icon: "instagram", label: "Instagram" },
  { key: "WHATSAPP", icon: "whatsapp", label: "WhatsApp" },
];

/**
 * Mesajlar → Test. The merchant types as the customer and the real agent
 * pipeline answers, so answers can be judged (and corrected) before any
 * channel goes live. Nothing here reaches Meta or the storefront widget.
 */
export function TestChat({
  correctedIds,
  onCorrect,
}: {
  correctedIds: Set<string>;
  onCorrect: (target: CorrectionTarget) => void;
}) {
  const { t } = useI18n();
  const tt = t.messages.test;

  const [channel, setChannel] = React.useState<TestChannel>("WEBCHAT");
  const [conversationId, setConversationId] = React.useState<string | null>(null);
  const [messages, setMessages] = React.useState<InboxMessageDTO[]>([]);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  // Pick the existing test conversation for this channel back up on switch.
  React.useEffect(() => {
    let alive = true;
    getTestChat(channel)
      .then((s) => {
        if (!alive) return;
        setConversationId(s.conversationId);
        setMessages(s.messages);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [channel]);

  const start = async () => {
    setBusy(true);
    const res = await startTestChat({ channel }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) return setError(res && !res.ok ? res.error : "generic");
    setError(null);
    setConversationId(res.state.conversationId);
    setMessages(res.state.messages);
  };

  const reset = async () => {
    if (!conversationId) return;
    setBusy(true);
    const res = await resetTestChat(conversationId).catch(() => null);
    setBusy(false);
    setConversationId(null);
    setMessages([]);
    if (res && !res.ok) setError(res.error);
  };

  const send = async () => {
    const text = draft.trim();
    if (!text || !conversationId || busy) return;
    setDraft("");
    // Show the merchant's line immediately; the agent's turn takes a moment.
    setMessages((prev) => [
      ...prev,
      {
        id: `tmp-${crypto.randomUUID()}`,
        role: "CUSTOMER",
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
    setBusy(true);
    const res = await sendTestMessage({ conversationId, text }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      setError(res && !res.ok ? res.error : "generic");
      return;
    }
    setError(null);
    // Server thread replaces the optimistic copy (real ids → correctable).
    setMessages(res.state.messages);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{tt.title}</p>
            <Badge variant="feature">{tt.badge}</Badge>
          </div>
          <p className="max-w-xl text-xs text-muted-foreground">{tt.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-border/60 p-1">
            {CHANNELS.map((c) => (
              <button
                key={c.key}
                onClick={() => setChannel(c.key)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                  channel === c.key
                    ? "bg-ink text-ink-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <ChannelIcon kind={c.icon} size="sm" className="size-3.5" />
                {c.label}
              </button>
            ))}
          </div>
          {conversationId && (
            <button
              onClick={reset}
              disabled={busy}
              className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <RotateCcw className="size-3.5" /> {tt.reset}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="flex flex-wrap items-start gap-2 border-b border-red-200 bg-red-50 px-4 py-2 text-xs text-red-800">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>
            {error === "no-session" ? tt.noSession : `${tt.error} ${error}`}
          </span>
          {error === "no-session" && (
            // The dashboard has no login of its own yet: the store session is
            // bound by the ikas connect round-trip, so give the tester the
            // one-click way back instead of a dead end.
            <a
              href="/api/auth/ikas/connect?returnTo=/mesajlar"
              className="font-medium underline underline-offset-2"
            >
              {t.crm.reconnect}
            </a>
          )}
        </div>
      )}

      {conversationId ? (
        <>
          <MessageThread
            messages={messages}
            conversationId={conversationId}
            correctedIds={correctedIds}
            onCorrect={onCorrect}
            pending={busy}
          />
          <div className="border-t border-border/60 p-3">
            <div className="flex items-center gap-2 rounded-2xl border border-input bg-card px-3.5 py-2 focus-within:ring-2 focus-within:ring-ring">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder={tt.placeholder}
                className="flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                onClick={send}
                disabled={!draft.trim() || busy}
                className="flex size-8 items-center justify-center rounded-xl bg-primary text-primary-foreground disabled:opacity-40"
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </button>
            </div>
          </div>
        </>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <p className="max-w-sm text-sm text-muted-foreground">{tt.empty}</p>
          <button
            onClick={start}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-brand-600 disabled:opacity-50"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
            {tt.start}
          </button>
        </div>
      )}
    </div>
  );
}
