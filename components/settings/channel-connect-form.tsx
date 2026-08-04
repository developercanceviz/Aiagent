"use client";

import * as React from "react";
import { KeyRound } from "lucide-react";

import { useI18n } from "@/lib/i18n/provider";
import { ikasFetch } from "@/lib/ikas/fetch";

type MetaChannelType = "INSTAGRAM" | "WHATSAPP" | "MESSENGER";

/**
 * Manual Meta-channel connect: paste the ids/token from the Meta developer
 * panel; the API stores them encrypted and flips the channel to CONNECTED.
 * The token is write-only — nothing ever reads it back to the client.
 */
export function ChannelConnectForm() {
  const { t } = useI18n();
  const f = t.settings.channelsPage.connectForm;

  const [type, setType] = React.useState<MetaChannelType>("INSTAGRAM");
  const [displayName, setDisplayName] = React.useState("");
  const [externalId, setExternalId] = React.useState("");
  const [accessToken, setAccessToken] = React.useState("");
  const [phoneNumberId, setPhoneNumberId] = React.useState("");
  const [state, setState] = React.useState<
    { kind: "idle" | "busy" | "ok" } | { kind: "error"; detail: string }
  >({ kind: "idle" });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "busy" });
    try {
      const res = await ikasFetch("/api/channels/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          displayName,
          externalId,
          accessToken,
          phoneNumberId: type === "WHATSAPP" ? phoneNumberId || externalId : null,
          igId: type === "INSTAGRAM" ? externalId : null,
          pageId: type === "MESSENGER" ? externalId : null,
          apiBase: type === "INSTAGRAM" ? "instagram" : "facebook",
        }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      setAccessToken("");
      setState({ kind: "ok" });
    } catch (err) {
      setState({
        kind: "error",
        detail: err instanceof Error ? err.message : "unknown",
      });
    }
  }

  const input =
    "h-10 w-full rounded-xl border border-input bg-card px-3 text-sm outline-none focus:ring-2 focus:ring-ring";

  return (
    <form
      onSubmit={submit}
      className="space-y-3 rounded-2xl border border-border/60 bg-card px-5 py-4 shadow-card"
    >
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-brand-700">
          <KeyRound className="size-5" />
        </div>
        <div>
          <h2 className="font-semibold">{f.title}</h2>
          <p className="text-sm text-muted-foreground">{f.subtitle}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          {f.channel}
          <select
            value={type}
            onChange={(e) => setType(e.target.value as MetaChannelType)}
            className={input}
          >
            <option value="INSTAGRAM">Instagram DM</option>
            <option value="WHATSAPP">WhatsApp Business</option>
            <option value="MESSENGER">Facebook Messenger</option>
          </select>
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground">
          {f.displayName}
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder={f.displayNamePlaceholder}
            required
            className={input}
          />
        </label>
        <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          {f.externalId}
          <input
            value={externalId}
            onChange={(e) => setExternalId(e.target.value)}
            required
            className={input}
          />
        </label>
        {type === "WHATSAPP" && (
          <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
            {f.phoneNumberId}
            <input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              className={input}
            />
          </label>
        )}
        <label className="space-y-1 text-xs font-medium text-muted-foreground sm:col-span-2">
          {f.accessToken}
          <input
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            required
            autoComplete="off"
            className={input}
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={state.kind === "busy"}
          className="h-10 rounded-xl bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-brand-600 disabled:opacity-50"
        >
          {f.submit}
        </button>
        {state.kind === "ok" && (
          <span className="text-sm font-medium text-emerald-600">{f.success}</span>
        )}
        {state.kind === "error" && (
          <span className="text-sm text-red-600">
            {f.error} {state.detail}
          </span>
        )}
      </div>
    </form>
  );
}
