"use client";

import { usePathname } from "next/navigation";
import { Rail, TabBar } from "@/components/domain/app-bars";
import type { Group } from "@/components/domain/types";
import { shelfGroupId } from "@/lib/auth/paths";
import { useAdd } from "./add";

// The tab bar (below 1024px) and the rail (from 1024px), DS 4.2.8. Add opens
// the search sheet. The rail leaves out Activity and Help until their screens
// exist (steps 6 and 8).
export function AppNav({ groups }: { groups: Group[] }) {
  const pathname = usePathname();
  const { openAdd } = useAdd();
  const add = () => openAdd();
  const current = pathname.startsWith("/shelf") ? "shelf" : pathname.startsWith("/you") ? "you" : undefined;

  return (
    <>
      <TabBar current={current} onAdd={add} />
      <Rail
        current={current}
        groups={groups}
        currentGroupId={shelfGroupId(pathname) ?? undefined}
        onAdd={add}
        hide={["activity", "help"]}
      />
    </>
  );
}
