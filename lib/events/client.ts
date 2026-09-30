"use client";

import type { EventName, EventProps } from "./schema";

// Record an event from the browser (PRD 11). Fire and forget: sendBeacon
// survives navigating away, and nothing waits on it.
export function track<N extends EventName>(name: N, props: EventProps<N> = {}): void {
  try {
    const body = JSON.stringify({ name, props });
    const sent = navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }));
    if (!sent) void fetch("/api/events", { method: "POST", body, keepalive: true, headers: { "Content-Type": "application/json" } }).catch(() => {});
  } catch {
    // Measurement never gets in the way.
  }
}
