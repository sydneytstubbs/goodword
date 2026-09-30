"use client";

import { usePathname } from "next/navigation";
import { Rail, TabBar } from "@/components/domain/app-bars";
import type { Group } from "@/components/domain/types";
import { shelfGroupId } from "@/lib/auth/paths";
import { isConversationPath } from "@/lib/conversations/paths";
import { useActivityCount } from "./activity-count";
import { KeyboardShortcuts } from "./keyboard-shortcuts";
import { useAdd } from "./add";
import { useShelfNews } from "./shelf-news";

// The tab bar (below 1024px) and the rail (from 1024px), DS 4.2.8. Add opens
// the search sheet. The conversation screen hides the tab bar so its composer
// sits at the bottom (PRD 6.2). Help sits in the rail's footer (DS 5.16).
export function AppNav({ groups }: { groups: Group[] }) {
  const pathname = usePathname();
  const { openAdd } = useAdd();
  const { counts } = useShelfNews();
  const { count: activityCount } = useActivityCount();
  const addFromTab = () => openAdd({ entryPoint: "tab" });
  const addFromRail = () => openAdd({ entryPoint: "rail" });
  const current = pathname.startsWith("/shelf") ? "shelf" : pathname.startsWith("/you") ? "you" : undefined;
  const railCurrent = pathname === "/activity" ? "activity" : current;

  return (
    <>
      <KeyboardShortcuts />
      {!isConversationPath(pathname) && (
        <TabBar current={current} onAdd={addFromTab} shelfDot={Object.values(counts).some((n) => n > 0)} />
      )}
      <Rail
        current={railCurrent}
        activityCount={activityCount}
        groups={groups}
        newCounts={counts}
        currentGroupId={shelfGroupId(pathname) ?? undefined}
        onAdd={addFromRail}
      />
    </>
  );
}
