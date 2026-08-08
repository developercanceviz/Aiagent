"use client";

import * as React from "react";

import { useI18n } from "@/lib/i18n/provider";
import { Switch } from "@/components/ui/switch";
import { ChannelIcon, type ChannelKind } from "@/components/channel-icon";
import {
  setChannelAiEnabled,
  type ChannelSettingRow,
} from "@/lib/actions/channel";

const ICON_BY_TYPE: Record<ChannelSettingRow["type"], ChannelKind> = {
  WHATSAPP: "whatsapp",
  MESSENGER: "messenger",
  WEBCHAT: "webchat",
  INSTAGRAM: "instagram",
};

/**
 * Per-channel AI on/off. The switch is optimistic but reverts if the server
 * refuses (no session / not this tenant's channel), so what you see always
 * matches Channel.aiEnabled in the database.
 */
export function ChannelAiToggles({ channels }: { channels: ChannelSettingRow[] }) {
  const { t } = useI18n();
  const tt = t.settings.aiAgentPage;
  const [rows, setRows] = React.useState(channels);
  const [, startTransition] = React.useTransition();

  // Server state wins on re-render (revalidatePath, navigation back, etc.).
  React.useEffect(() => setRows(channels), [channels]);

  const toggle = (row: ChannelSettingRow) => {
    if (!row.id) return;
    const next = !row.aiEnabled;
    setRows((prev) =>
      prev.map((r) => (r.type === row.type ? { ...r, aiEnabled: next } : r))
    );
    startTransition(async () => {
      const res = await setChannelAiEnabled(row.id!, next).catch(() => null);
      if (!res?.ok) {
        setRows((prev) =>
          prev.map((r) => (r.type === row.type ? { ...r, aiEnabled: !next } : r))
        );
      }
    });
  };

  return (
    <div className="divide-y divide-border/60">
      {rows.map((row) => (
        <div key={row.type} className="flex items-center gap-3 px-5 py-4">
          <ChannelIcon kind={ICON_BY_TYPE[row.type]} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{row.label}</p>
            <p className="truncate text-xs text-muted-foreground">
              {row.displayName}
            </p>
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            {!row.id ? tt.notConnected : row.aiEnabled ? tt.aiActive : tt.passive}
          </span>
          <Switch
            checked={row.aiEnabled}
            disabled={!row.id}
            onCheckedChange={() => toggle(row)}
          />
        </div>
      ))}
    </div>
  );
}
