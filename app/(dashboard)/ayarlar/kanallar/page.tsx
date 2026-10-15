"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, Link2, Loader2, RefreshCw, RotateCcw } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { ChannelIcon, type ChannelKind } from "@/components/channel-icon";
import { ChannelConnectForm } from "@/components/settings/channel-connect-form";

const connected: { kind: ChannelKind; name: string; sub: string }[] = [
  { kind: "instagram", name: "Instagram DM", sub: "@canceviz_hurma · Can Ceviz Müşteri Destek Asistanı" },
  { kind: "whatsapp", name: "WhatsApp Business", sub: "+90 553 522 98 95 · Can Ceviz Müşteri Destek Asistanı" },
  { kind: "messenger", name: "Facebook Messenger", sub: "Canceviz hurma · Can Ceviz Müşteri Destek Asistanı" },
];

/**
 * Instagram's own reconnect — only this channel has a real OAuth flow today
 * (app/api/auth/instagram/*); WhatsApp/Messenger still use the manual form
 * below until the same flow is built for them.
 *
 * This can't be a plain link: the whole dashboard runs inside ikas's admin
 * iframe, and Instagram's consent screen refuses to be framed at all
 * (confirmed live — "refused to connect"). So this fetches the authorize URL
 * via a same-origin request (which DOES carry the iframe-scoped session
 * cookie, unlike a cross-context navigation) and opens it in a real new tab.
 * See signInstagramOAuthState's comment for the full reasoning.
 */
function InstagramReconnectButton() {
  const [state, setState] = React.useState<"idle" | "busy" | "error">("idle");

  const connect = async () => {
    setState("busy");
    try {
      const res = await fetch("/api/auth/instagram/authorize");
      const json = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !json.url) throw new Error(json.error ?? `HTTP ${res.status}`);
      window.open(json.url, "_blank", "noopener,noreferrer");
      setState("idle");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="flex items-center gap-1">
      {state === "error" && (
        <span className="flex items-center gap-1 text-[11px] text-red-600" title="Bağlanılamadı, tekrar deneyin">
          <AlertTriangle className="size-3" />
        </span>
      )}
      <button
        onClick={connect}
        disabled={state === "busy"}
        className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent disabled:opacity-50"
        aria-label="Yeniden bağlan"
        title="Yeniden bağlan — yeni sekmede Instagram onay ekranı açılır"
      >
        {state === "busy" ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <RotateCcw className="size-4" />
        )}
      </button>
    </div>
  );
}

export default function KanallarPage() {
  const { t } = useI18n();
  const tt = t.settings.channelsPage;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-card">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-brand-700">
            <Link2 className="size-5" />
          </div>
          <div>
            <h1 className="font-semibold">{tt.title}</h1>
            <p className="text-sm text-muted-foreground">{tt.subtitle}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 px-1 text-sm text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Link2 className="size-4 text-primary" /> 3 / 3 {tt.connectedCount}
        </span>
        <button className="flex items-center gap-1.5 hover:text-foreground">
          <RefreshCw className="size-3.5" /> {tt.refresh}
        </button>
      </div>

      <p className="px-1 text-xs font-semibold tracking-wide text-muted-foreground">
        {tt.connected}
      </p>
      <div className="space-y-2">
        {connected.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 shadow-card"
          >
            <ChannelIcon kind={c.kind} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium">{c.name}</p>
                <Badge variant="success">● {tt.connectedBadge}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{c.sub}</p>
            </div>
            {c.kind === "instagram" ? (
              <InstagramReconnectButton />
            ) : (
              <button
                className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent"
                aria-label="Yeniden bağlan"
                disabled
                title="Bu kanal için otomatik yeniden bağlama henüz yok — aşağıdaki formu kullanın."
              >
                <RotateCcw className="size-4" />
              </button>
            )}
          </div>
        ))}
      </div>

      <p className="px-1 pt-2 text-xs font-semibold tracking-wide text-muted-foreground">
        {tt.addable}
      </p>
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3.5">
        <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
        <div>
          <p className="text-sm font-medium text-emerald-800">{tt.allConnectedTitle}</p>
          <p className="text-xs text-emerald-700/80">{tt.allConnectedBody}</p>
        </div>
      </div>

      <ChannelConnectForm />

      <div className="flex items-start gap-2.5 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-xs text-muted-foreground shadow-card">
        <Info className="mt-0.5 size-4 shrink-0 text-sky-500" />
        <p>{tt.info}</p>
      </div>
    </div>
  );
}
