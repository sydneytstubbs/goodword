"use client";

import type { SwitcherGroup } from "@/components/domain/group-switcher";
import { LiveList } from "../live-list";
import type { List } from "@/components/domain/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";
import { useAdd } from "../../add";
import { ListBar } from "../list-bar";
import { useMarkViewed } from "../../list-news";
import { ListCards } from "../list-cards";

// All groups (PRD F5.2): every group you're in, one card per title, each person once.
export function AllGroupsList({ groups, list }: { groups: SwitcherGroup[]; list: List }) {
  const { openAdd } = useAdd();
  // Viewing All groups counts as viewing each group in it.
  useMarkViewed(groups.map((g) => g.id));
  return (
    <>
      <ListBar groups={groups} currentId="all" />
      <LiveList groupIds={groups.map((g) => g.id)} />
      <h1 className="text-title-l text-default">{t("groups.allGroups")}</h1>
      <ListCards
        cards={list.cards}
        services={list.services}
        scope={{ kind: "all", groupIds: groups.map((g) => g.id) }}
        empty={
          <EmptyState
            showList
            headingLevel={2}
            title={t("list.allEmptyTitle")}
            body={t("list.allEmptyBody")}
            action={
              <Button variant="primary" size="lg" icon="add" onClick={() => openAdd({ entryPoint: "empty_state" })}>
                {t("vouch.put")}
              </Button>
            }
          />
        }
      />
    </>
  );
}
