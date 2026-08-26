"use client";

import * as React from "react";
import { Check, Minus, Plus, Power, Rocket, Settings2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useI18n } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { WidgetPreview } from "@/components/widget/widget-preview";
import { widgetThemes, type WidgetTheme } from "@/lib/config/widget-themes";
import {
  publishWidgetSettings,
  setWidgetActive,
  type WidgetSettings,
} from "@/lib/actions/widget";

export function WebChatSettings({ settings }: { settings: WidgetSettings }) {
  const { t } = useI18n();
  const tt = t.settings.webChatPage;
  const [theme, setTheme] = React.useState<WidgetTheme>(
    () => widgetThemes.find((th) => th.key === settings.theme) ?? widgetThemes[0]!
  );
  const [bubbleSize, setBubbleSize] = React.useState(settings.bubbleSize);
  const [active, setActive] = React.useState(settings.active);
  const [publishState, setPublishState] = React.useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [, startTransition] = React.useTransition();

  // Server state wins on re-render (revalidatePath, navigating back, etc.).
  React.useEffect(() => setActive(settings.active), [settings.active]);

  // Any appearance edit means the published version is stale again.
  React.useEffect(() => setPublishState("idle"), [theme, bubbleSize]);

  /**
   * Store visibility. Optimistic, but reverts if the server refuses (no
   * session / no DB) so the switch always mirrors WidgetConfig.active.
   */
  const toggleActive = () => {
    const next = !active;
    setActive(next);
    startTransition(async () => {
      const res = await setWidgetActive(next).catch(() => null);
      if (!res?.ok) setActive(!next);
    });
  };

  const publish = () => {
    setPublishState("saving");
    startTransition(async () => {
      const res = await publishWidgetSettings({ theme: theme.key, bubbleSize }).catch(
        () => null
      );
      setPublishState(res?.ok ? "saved" : "error");
    });
  };

  const colorFields: { label: string; hint?: string; value: string }[] = [
    { label: tt.primaryColor, hint: tt.primaryColorHint, value: theme.primaryColor },
    { label: tt.headerBg, value: theme.headerBg },
    { label: tt.headerText, value: theme.headerText },
    { label: tt.userMsgColor, value: theme.userMsgColor },
    { label: tt.botMsgColor, value: theme.botMsgColor },
    { label: tt.bubbleColor, value: theme.bubbleColor },
    { label: tt.bubbleIconColor, value: theme.bubbleIcon },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[380px_1fr]">
      {/* Settings column */}
      <div className="flex flex-col rounded-2xl border border-border/60 bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-brand-700">
              <Settings2 className="size-5" />
            </div>
            <div>
              <p className="font-semibold">{tt.title}</p>
              <p className="text-xs text-muted-foreground">{tt.subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Without a store session we don't know the real state, so we say
                so rather than showing a confident (and possibly wrong) badge. */}
            <Badge
              variant={
                !settings.editable ? "outline" : active ? "success" : "secondary"
              }
            >
              <Power className="size-3" />{" "}
              {!settings.editable ? tt.noStore : active ? tt.active : tt.passive}
            </Badge>
            <Switch
              checked={settings.editable && active}
              disabled={!settings.editable}
              onCheckedChange={toggleActive}
              aria-label={tt.storeVisibility}
            />
          </div>
        </div>

        {settings.editable && !active && (
          <p className="border-b border-border/60 bg-amber-50 px-4 py-2.5 text-xs text-amber-800">
            {tt.hiddenNotice}
          </p>
        )}

        <div className="p-4">
          <Tabs defaultValue="appearance">
            <TabsList className="w-full">
              <TabsTrigger value="appearance" className="flex-1">
                {tt.tabs.appearance}
              </TabsTrigger>
              <TabsTrigger value="content" className="flex-1">
                {tt.tabs.content}
              </TabsTrigger>
              <TabsTrigger value="position" className="flex-1">
                {tt.tabs.position}
              </TabsTrigger>
              <TabsTrigger value="social" className="flex-1">
                {tt.tabs.social}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-5 px-4 pb-4">
          {/* Preset themes */}
          <div>
            <p className="mb-2 text-sm font-medium">{tt.presetThemes}</p>
            <div className="grid grid-cols-3 gap-2">
              {widgetThemes.map((th) => {
                const active = th.key === theme.key;
                return (
                  <button
                    key={th.key}
                    onClick={() => setTheme(th)}
                    className={cn(
                      "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-colors",
                      active
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    )}
                  >
                    {active && (
                      <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="size-2.5" />
                      </span>
                    )}
                    <div className="flex gap-1">
                      {th.swatch.map((s) => (
                        <span
                          key={s}
                          className="size-4 rounded-full"
                          style={{ backgroundColor: s }}
                        />
                      ))}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{th.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Color fields */}
          <div className="space-y-3">
            {colorFields.map((f) => (
              <div key={f.label}>
                <p className="text-sm font-medium">{f.label}</p>
                {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-input bg-card p-1.5">
                  <span
                    className="size-8 rounded-lg border border-black/5"
                    style={{ backgroundColor: f.value }}
                  />
                  <span className="text-sm text-muted-foreground">{f.value}</span>
                </div>
              </div>
            ))}

            {/* Bubble size */}
            <div>
              <p className="text-sm font-medium">{tt.bubbleSize}</p>
              <div className="mt-1.5 flex items-center gap-3">
                <button
                  onClick={() => setBubbleSize((s) => Math.max(40, s - 4))}
                  className="flex size-8 items-center justify-center rounded-lg border border-input hover:bg-accent"
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-12 text-center text-sm font-medium">{bubbleSize} px</span>
                <button
                  onClick={() => setBubbleSize((s) => Math.min(80, s + 4))}
                  className="flex size-8 items-center justify-center rounded-lg border border-input hover:bg-accent"
                >
                  <Plus className="size-4" />
                </button>
                <input
                  type="range"
                  min={40}
                  max={80}
                  value={bubbleSize}
                  onChange={(e) => setBubbleSize(Number(e.target.value))}
                  className="flex-1 accent-[#14daaa]"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-auto space-y-2 border-t border-border/60 p-4">
          <Button
            className="h-12 w-full text-base"
            onClick={publish}
            disabled={!settings.editable || publishState === "saving"}
          >
            <Rocket className="size-4" />
            {publishState === "saving"
              ? tt.publishing
              : publishState === "saved"
                ? tt.published
                : publishState === "error"
                  ? tt.publishFailed
                  : tt.publish}
          </Button>
          <button className="w-full text-center text-sm text-muted-foreground hover:text-foreground">
            {tt.viewInStore}
          </button>
        </div>
      </div>

      {/* Preview column */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-[repeating-linear-gradient(45deg,#fafafa,#fafafa_12px,#f4f4f5_12px,#f4f4f5_24px)] shadow-card">
        <div className="flex items-center gap-2 border-b border-border/60 bg-card px-4 py-3">
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">
            {tt.livePreview}
          </span>
        </div>
        <div className="flex min-h-[560px] items-end justify-end p-8">
          <WidgetPreview theme={theme} />
        </div>
      </div>
    </div>
  );
}
