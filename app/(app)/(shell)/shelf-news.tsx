"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

// New since your last visit (PRD F5.5): how many new good words each group
// has, for the group switcher's counts and the Shelf tab's dot. "Last
// viewed" updates when you leave a shelf or after 10 seconds on it, never on
// arrival, so the New badges on its cards don't vanish before you see them.

type ShelfNews = {
  counts: Record<string, number>;
  markViewed: (groupIds: string[]) => void;
};

const ShelfNewsContext = createContext<ShelfNews>({ counts: {}, markViewed: () => {} });

export function useShelfNews(): ShelfNews {
  return useContext(ShelfNewsContext);
}

export function ShelfNewsProvider({ counts: serverCounts, children }: { counts: Record<string, number>; children: ReactNode }) {
  // Groups viewed since the server last counted. Fresh counts from the server start over.
  const [viewed, setViewed] = useState({ source: serverCounts, ids: new Set<string>() });
  const ids = viewed.source === serverCounts ? viewed.ids : new Set<string>();
  const counts = Object.fromEntries(Object.entries(serverCounts).map(([id, n]) => [id, ids.has(id) ? 0 : n]));

  const markViewed = useCallback(
    (groupIds: string[]) => {
      if (groupIds.length === 0) return;
      setViewed((v) => {
        const base = v.source === serverCounts ? v.ids : new Set<string>();
        return { source: serverCounts, ids: new Set([...base, ...groupIds]) };
      });
      fetch("/api/shelves/viewed", {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groups: groupIds }),
      }).catch(() => {
        // Offline: the shelf is marked next time.
      });
    },
    [serverCounts],
  );

  return <ShelfNewsContext.Provider value={{ counts, markViewed }}>{children}</ShelfNewsContext.Provider>;
}

const VIEW_AFTER_MS = 10_000;

/** Marks these shelves viewed after 10 seconds, or when the viewer leaves or closes the page. */
export function useMarkViewed(groupIds: string[]) {
  const { markViewed } = useShelfNews();
  const key = groupIds.join(",");
  useEffect(() => {
    const ids = key ? key.split(",") : [];
    let done = false;
    const mark = () => {
      if (done) return;
      done = true;
      markViewed(ids);
    };
    const onHidden = () => document.visibilityState === "hidden" && mark();
    const timer = window.setTimeout(mark, VIEW_AFTER_MS);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", mark);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", mark);
      mark();
    };
    // markViewed changes when fresh counts arrive; that isn't a new visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
