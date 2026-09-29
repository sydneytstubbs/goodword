"use client";

import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { activityCount } from "@/lib/conversations/actions";
import { useBroadcast } from "@/lib/supabase/realtime";

// The bell's unread count (PRD F14, DS 4.2.8): from the server on load, then
// live. A new Activity item for the viewer arrives on their private channel
// within seconds; the count is re-read after each screen change too, since
// opening a conversation or a group marks items read.

type ActivityCount = { count: number; refresh: () => void };

const ActivityCountContext = createContext<ActivityCount>({ count: 0, refresh: () => {} });

export function useActivityCount(): ActivityCount {
  return useContext(ActivityCountContext);
}

export function ActivityCountProvider({
  userId,
  initialCount,
  children,
}: {
  userId: string;
  initialCount: number;
  children: ReactNode;
}) {
  const [count, setCount] = useState(initialCount);
  const pathname = usePathname();

  const refresh = useCallback(() => {
    activityCount()
      .then(setCount)
      .catch(() => {
        // Offline: keep the last count.
      });
  }, []);

  useEffect(() => {
    refresh();
  }, [pathname, refresh]);

  useBroadcast(userId ? `activity:${userId}` : null, "activity", refresh);

  return <ActivityCountContext.Provider value={{ count, refresh }}>{children}</ActivityCountContext.Provider>;
}
