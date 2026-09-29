"use client";

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useRef } from "react";

// Live updates through Realtime Broadcast on private channels (PRD F13,
// F14). The database only lets members listen to a group's conversations,
// and each person to their own Activity. Messages carry ids, never text.
// The Supabase client loads after the page is interactive, so it never
// slows the first render (DS 9).

type Handler = (payload: Record<string, unknown>) => void;

/**
 * Listens for `event` on the private channel `topic` while mounted.
 * `onSubscribed` runs each time the channel (re)connects, so a screen can
 * catch up on anything it missed while the connection was down.
 */
export function useBroadcast(topic: string | null, event: string, onMessage: Handler, onSubscribed?: () => void) {
  const handlers = useRef({ onMessage, onSubscribed });
  useEffect(() => {
    handlers.current = { onMessage, onSubscribed };
  });

  useEffect(() => {
    if (!topic) return;
    let supabase: SupabaseClient | null = null;
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    (async () => {
      const { createClient } = await import("./client");
      if (cancelled) return;
      supabase = createClient();
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(topic, { config: { private: true } })
        .on("broadcast", { event }, ({ payload }) => handlers.current.onMessage(payload as Record<string, unknown>))
        .subscribe((status) => {
          if (status === "SUBSCRIBED") handlers.current.onSubscribed?.();
        });
    })().catch(() => {
      // No live updates this time; the screen still works and refreshes on the next load.
    });
    return () => {
      cancelled = true;
      if (supabase && channel) void supabase.removeChannel(channel);
    };
  }, [topic, event]);
}
