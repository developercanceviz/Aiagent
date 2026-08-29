"use client";

import * as React from "react";
import { Bot, Check, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import type { InboxMessageDTO } from "@/lib/actions/conversation";
import type { CorrectionTarget } from "@/components/inbox/correct-answer-dialog";

/**
 * Message list shared by the real inbox and the test chat, so a correction
 * works identically in both. Every AI bubble carries a "Düzelt" action; the
 * question sent to the correction dialog is the customer line directly above
 * it, which is what the answer was actually responding to.
 */
export function MessageThread({
  messages,
  conversationId,
  correctedIds,
  onCorrect,
  pending,
}: {
  messages: InboxMessageDTO[];
  conversationId: string | null;
  correctedIds: Set<string>;
  onCorrect: (target: CorrectionTarget) => void;
  pending?: boolean;
}) {
  const { t } = useI18n();
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending]);

  const questionFor = (index: number) => {
    for (let i = index - 1; i >= 0; i--) {
      if (messages[i]!.role === "CUSTOMER") return messages[i]!.content;
    }
    return "";
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
      {messages.map((m, index) => (
        <div
          key={m.id}
          className={cn(
            "flex flex-col",
            m.role === "CUSTOMER" ? "items-start" : "items-end"
          )}
        >
          <div
            className={cn(
              "max-w-[75%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm",
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

          {m.role === "AI" &&
            (correctedIds.has(m.id) ? (
              <span className="mt-0.5 flex items-center gap-1 text-[11px] text-brand-700">
                <Check className="size-3" /> {t.messages.correct.corrected}
              </span>
            ) : (
              <button
                onClick={() =>
                  onCorrect({
                    messageId: m.id,
                    conversationId,
                    question: questionFor(index),
                    badAnswer: m.content,
                  })
                }
                className="mt-0.5 flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Pencil className="size-3" /> {t.messages.correct.cta}
              </button>
            ))}
        </div>
      ))}

      {pending && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Bot className="size-3.5 animate-pulse" /> {t.messages.test.thinking}
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
