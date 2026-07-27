"use client";

import * as React from "react";

import {
  createSupabaseBrowserClient,
  supabaseConfiguredOnClient,
} from "@/lib/supabase/client";

/**
 * Subscribe to conversation/message changes via Supabase Realtime and invoke
 * `onChange` so the inbox can refresh. No-op when Supabase isn't configured, so
 * the inbox still works on mock data.
 */
export function useConversationsRealtime(onChange: () => void) {
  const cb = React.useRef(onChange);
  cb.current = onChange;

  React.useEffect(() => {
    if (!supabaseConfiguredOnClient) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel("inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () =>
        cb.current()
      )
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () =>
        cb.current()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
}
