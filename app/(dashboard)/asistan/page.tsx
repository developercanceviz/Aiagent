"use client";

import { useChat } from "@ai-sdk/react";
import { Send, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Dictionary } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n/provider";
import { ikasFetch } from "@/lib/ikas/fetch";
import { ChatMarkdown } from "@/components/chat-markdown";

export default function AsistanPage() {
  const { t } = useI18n();
  const a = t.assistant;

  const { messages, input, handleInputChange, handleSubmit, append, error, status } =
    useChat({
      api: "/api/chat/assistant",
      // Carries the ikas App Bridge token when embedded; plain fetch otherwise.
      fetch: ikasFetch as typeof fetch,
    });

  const chips = [
    a.chips.ordersToday,
    a.chips.revenue7d,
    a.chips.topCities,
    a.chips.pendingShipments,
  ];

  const empty = messages.length === 0;
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="flex h-full flex-col rounded-2xl border border-border/60 bg-card shadow-card">
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        {empty ? (
          <div className="flex flex-1 flex-col items-center justify-center px-4 text-center">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-brand-700">
              <Sparkles className="size-6" />
            </div>
            <h2 className="mt-4 text-2xl font-semibold">{a.greeting}</h2>
            <p className="mt-1 text-muted-foreground">{a.subtitle}</p>
            <div className="mt-6 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => append({ role: "user", content: c })}
                  className="rounded-2xl border border-border/60 bg-card px-5 py-4 text-left text-sm font-medium text-foreground/90 transition-colors hover:border-primary/40 hover:bg-accent"
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-6">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  {m.role === "user" ? (
                    m.content
                  ) : m.content ? (
                    <ChatMarkdown>{m.content}</ChatMarkdown>
                  ) : busy ? (
                    "…"
                  ) : (
                    ""
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {error && <ErrorBanner message={error.message} t={a} />}

      <form onSubmit={handleSubmit} className="border-t border-border/60 p-4">
        <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-2xl border border-input bg-card px-4 py-2 shadow-sm focus-within:ring-2 focus-within:ring-ring">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder={a.placeholder}
            className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            disabled={!input.trim() || busy}
            className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-colors hover:bg-brand-600 disabled:opacity-40"
          >
            <Send className="size-4" />
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * The API sends structured JSON errors ({"error": "..."}); stream errors
 * arrive as plain text. Show the real reason — and for a lost session, a
 * one-click reconnect that lands straight back on this page.
 */
function ErrorBanner({
  message,
  t,
}: {
  message: string;
  t: Dictionary["assistant"];
}) {
  let detail = message;
  try {
    detail = (JSON.parse(message) as { error?: string }).error ?? message;
  } catch {
    // not JSON — keep the raw message
  }
  const sessionLost = detail.includes("No store in session");

  return (
    <div className="mx-4 mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
      {sessionLost ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>{t.errorSession}</span>
          <a
            href="/api/auth/ikas/connect?returnTo=/asistan"
            className="shrink-0 rounded-lg bg-amber-700 px-3 py-1.5 font-medium text-amber-50 transition-colors hover:bg-amber-800"
          >
            {t.errorSessionCta}
          </a>
        </div>
      ) : (
        <span>
          {t.errorGeneric} {detail}
        </span>
      )}
    </div>
  );
}
