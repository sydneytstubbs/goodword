"use client";

import { usePathname } from "next/navigation";
import { Rail, TabBar } from "@/components/domain/app-bars";
import type { Group } from "@/components/domain/types";
import { shelfGroupId } from "@/lib/auth/paths";
import { isConversationPath } from "@/lib/conversations/paths";
import { useActivityCount } from "./activity-count";
import { useAdd } from "./add";
import { useShelfNews } from "./shelf-news";

// The tab bar (below 1024px) and the rail (from 1024px), DS 4.2.8. Add opens
// the search sheet. The conversation screen hides the tab bar so its composer
// sits at the bottom (PRD 6.2). The rail leaves out Help until its screen
// exists (step 8).
export function AppNav({ groups }: { groups: Group[] }) {
  const pathname = usePathname();
  const { openAdd } = useAdd();
  const { counts } = useShelfNews();
  const { count: activityCount } = useActivityCount();
  const add = () => openAdd();
  const current = pathname.startsWith("/shelf") ? "shelf" : pathname.startsWith("/you") ? "you" : undefined;
  const railCurrent = pathname === "/activity" ? "activity" : current;

  return (
    <>
      {!isConversationPath(pathname) && (
        <TabBar current={current} onAdd={add} shelfDot={Object.values(counts).some((n) => n > 0)} />
      )}
      <Rail
        current={railCurrent}
        activityCount={activityCount}
        groups={groups}
        newCounts={counts}
        currentGroupId={shelfGroupId(pathname) ?? undefined}
        onAdd={add}
        hide={["help"]}
      />
    </>
  );
}
