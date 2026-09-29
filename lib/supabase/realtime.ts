"use client";

import { useEffect, useRef } from "react";
import { createClient } from "./client";

// Live updates through Realtime Broadcast on private channels (PRD F13,
// F14). The database only lets members listen to a group's conversations,
// and each person to their own Activity. Messages carry ids, never text.

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
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;
    (async () => {
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
      if (channel) void supabase.removeChannel(channel);
    };
  }, [topic, event]);
}
