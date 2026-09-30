"use client";

import { useEffect } from "react";

// Registers the service worker (PRD F12) in production only, so development
// never serves stale pages.
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Without it the app still works online, like any site.
    });
  }, []);
  return null;
}
