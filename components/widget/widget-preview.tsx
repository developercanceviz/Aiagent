import { Send, X } from "lucide-react";

import { ChannelIcon } from "@/components/channel-icon";
import { DevCredit } from "@/components/layout/dev-credit";
import { demoStore } from "@/lib/config/brand";
import type { WidgetTheme } from "@/lib/config/widget-themes";

/**
 * Faithful render of the embeddable Web Chat widget. Shared between the
 * Ayarlar live preview and (Phase 5) the standalone `/widget` bundle so the
 * preview never drifts from production.
 */
export function WidgetPreview({
  theme,
  greeting = "Merhaba! 👋 Size nasıl yardımcı olabilirim?",
}: {
  theme: WidgetTheme;
  greeting?: string;
}) {
  return (
    <div className="w-[320px] overflow-hidden rounded-3xl bg-white shadow-2xl">
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-3.5"
        style={{ backgroundColor: theme.headerBg, color: theme.headerText }}
      >
        <div
          className="flex size-9 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.primaryColor }}
        >
          <span className="text-sm font-bold text-black/80">C</span>
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold">{demoStore.storeName}</p>
          <p className="flex items-center gap-1 text-[11px] opacity-80">
            <span
              className="size-1.5 rounded-full"
              style={{ backgroundColor: theme.primaryColor }}
            />
            Çevrimiçi
          </p>
        </div>
        <X className="size-4 opacity-70" />
      </div>

      {/* Messages */}
      <div className="space-y-2.5 bg-white px-3 py-4">
        <Bubble side="bot" color={theme.botMsgColor}>
          {greeting}
        </Bubble>
        <Bubble side="user" color={theme.userMsgColor}>
          Merhaba, siparişimin durumunu öğrenmek istiyorum
        </Bubble>
        <Bubble side="bot" color={theme.botMsgColor}>
          Tabii ki! Sipariş numaranızı paylaşır mısınız? 📦
        </Bubble>

        {/* Social row */}
        <div className="flex items-center justify-center gap-2 py-1.5">
          <ChannelIcon kind="instagram" size="sm" className="size-8 rounded-full" />
          <ChannelIcon kind="whatsapp" size="sm" className="size-8 rounded-full bg-[#25d366] text-white" />
          <ChannelIcon kind="messenger" size="sm" className="size-8 rounded-full bg-[#0084ff] text-white" />
          <div className="flex size-8 items-center justify-center rounded-full bg-black text-white">
            <span className="text-[10px] font-bold">TT</span>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-3">
        <div className="flex h-9 flex-1 items-center rounded-full bg-zinc-100 px-3.5 text-xs text-zinc-400">
          Mesajınızı yazın...
        </div>
        <button
          className="flex size-9 items-center justify-center rounded-full"
          style={{ backgroundColor: theme.primaryColor }}
        >
          <Send className="size-4 text-black/70" />
        </button>
      </div>

      {/* Footer */}
      <div className="flex justify-center pb-3">
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
        className="max-w-[78%] rounded-2xl px-3 py-2 text-xs leading-relaxed"
        style={{
          backgroundColor: color,
          color: isUser ? "#04241d" : "#27272a",
        }}
      >
        {children}
      </div>
    </div>
  );
}
