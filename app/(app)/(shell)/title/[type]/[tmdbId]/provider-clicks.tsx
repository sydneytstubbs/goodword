"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/events/client";

// Records where-to-watch taps (PRD 11.2, H5): which provider, on which title,
// and whether friends had vouched for it. The links open in a new tab, so the
// event goes with sendBeacon and never delays them.
export function ProviderClicks({ titleId, fromGoodWord, children }: { titleId: string | null; fromGoodWord: boolean; children: ReactNode }) {
  return (
    <div
      onClickCapture={(event) => {
        const link = (event.target as HTMLElement).closest<HTMLElement>("[data-provider-id]");
        const providerId = Number(link?.dataset.providerId);
        if (!link || !Number.isFinite(providerId)) return;
        track("where_to_watch_clicked", { provider_id: providerId, from_good_word: fromGoodWord, ...(titleId ? { title_id: titleId } : {}) });
      }}
    >
      {children}
    </div>
  );
}
