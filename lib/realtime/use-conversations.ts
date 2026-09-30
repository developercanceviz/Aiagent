"use client";

import * as React from "react";

import {
  createSupabaseBrowserClient,
  supabaseConfiguredOnClient,
} from "@/lib/supabase/client";

/**
 * Subscribe to conversation/message changes via Supabase Realtime.
 *
 * `onListChange` fires on any conversation-row change or new message, so the
 * left-hand list (ordering, unread count, preview) stays live. `onMessageInsert`
 * fires separately with the inserted message's conversationId: the open thread
 * pane only ever fetches on activeId *changing* (see InboxView), so without
 * this, a message that arrives while its conversation is already open just
 * sits invisible until the merchant clicks away and back — this is what read
 * as "the AI replies on Instagram but nothing shows up in the panel": the
 * reply was saved and sent, the open thread just never re-fetched it.
 * No-op when Supabase isn't configured, so the inbox still works on mock data.
 */
export function useConversationsRealtime(
  onListChange: () => void,
  onMessageInsert?: (conversationId: string) => void
) {
  const listCb = React.useRef(onListChange);
  listCb.current = onListChange;
  const msgCb = React.useRef(onMessageInsert);
  msgCb.current = onMessageInsert;

  React.useEffect(() => {
    if (!supabaseConfiguredOnClient) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        listCb.current()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          listCb.current();
          const row = payload.new as Record<string, unknown> | undefined;
          const conversationId = (row?.conversationId ?? row?.conversation_id) as
            | string
            | undefined;
          if (conversationId) msgCb.current?.(conversationId);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
}
