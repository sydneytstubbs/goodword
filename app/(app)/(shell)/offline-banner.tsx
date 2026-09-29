"use client";

import { useSyncExternalStore } from "react";
import { Banner } from "@/components/ui/banner";
import { t } from "@/lib/messages";

// Offline (DS 5.12, PRD F12 baseline): a banner while there's no connection.
// What's already loaded stays on screen; writes explain that they need a
// connection and keep what you typed.
const subscribe = (onChange: () => void) => {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
};

export function OfflineBanner() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  if (!offline) return null;
  return (
    <div className="mx-auto w-full max-w-content px-4 pb-4">
      <Banner icon="offline">{t("shelf.offline")}</Banner>
    </div>
  );
}
