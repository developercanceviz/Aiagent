"use client";

import * as React from "react";
import { useChat } from "@ai-sdk/react";
import { Send, X } from "lucide-react";

import type { WidgetConfigDTO } from "@/lib/db/widget";
import { DevCredit } from "@/components/layout/dev-credit";
import { ChatMarkdown } from "@/components/chat-markdown";

/** Stable per-visitor session id (one conversation per browser). */
function useSessionId() {
  return React.useMemo(() => {
    if (typeof window === "undefined") return "ssr";
    const k = "canceviz_widget_session";
    let id = localStorage.getItem(k);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(k, id);
    }
    return id;
  }, []);
}

export function LiveWidget({
  merchantId,
  config,
}: {
  merchantId: string;
  config: WidgetConfigDTO;
}) {
  const sessionId = useSessionId();
  const { messages, input, handleInputChange, handleSubmit, status } = useChat({
    api: "/api/chat/webchat",
    body: { merchantId, sessionId },
  });
  const busy = status === "submitted" || status === "streaming";
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  return (
    <div className="flex h-screen w-full flex-col bg-white">
      <div
        className="flex items-center gap-3 px-4 py-3.5"
        style={{ backgroundColor: config.headerBg, color: config.headerText }}
      >
        <div
          className="flex size-9 items-center justify-center rounded-full text-sm font-bold text-black/80"
          style={{ backgroundColor: config.primaryColor }}
        >
          {config.storeName.charAt(0)}
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{config.storeName}</p>
          <p className="flex items-center gap-1 text-[11px] opacity-80">
            <span className="size-1.5 rounded-full" style={{ backgroundColor: config.primaryColor }} />
            Çevrimiçi
          </p>
        </div>
        <button onClick={() => window.parent.postMessage("canceviz:close", "*")}>
          <X className="size-4 opacity-70" />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-2.5 overflow-y-auto px-3 py-4">
        <Bubble side="bot" color={config.botMsgColor}>
          {config.greeting}
        </Bubble>
        {messages.map((m) => (
          <Bubble
            key={m.id}
            side={m.role === "user" ? "user" : "bot"}
            color={m.role === "user" ? config.userMsgColor : config.botMsgColor}
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
          </Bubble>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-zinc-100 px-3 py-3">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Mesajınızı yazın..."
          className="h-9 flex-1 rounded-full bg-zinc-100 px-3.5 text-sm outline-none"
        />
        <button
          type="submit"
          disabled={!input.trim() || busy}
          className="flex size-9 items-center justify-center rounded-full disabled:opacity-40"
          style={{ backgroundColor: config.primaryColor }}
        >
          <Send className="size-4 text-black/70" />
        </button>
      </form>

      <div className="flex justify-center pb-2">
        <DevCredit className="scale-90" />
      </div>
    </div>
  );
}

function Bubble({
  side,
  color,
  children,
}: {
  side: "bot" | "user";
  color: string;
  children: React.ReactNode;
}) {
  const isUser = side === "user";
  return (
    <div className={isUser ? "flex justify-end" : "flex justify-start"}>
      <div
        className="max-w-[78%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-relaxed"
        style={{ backgroundColor: color, color: isUser ? "#04241d" : "#27272a" }}
      >
        {children}
      </div>
    </div>
  );
}
