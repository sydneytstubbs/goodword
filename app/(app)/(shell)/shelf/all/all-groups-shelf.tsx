"use client";

import type { SwitcherGroup } from "@/components/domain/group-switcher";
import { LiveShelf } from "../live-shelf";
import type { Shelf } from "@/components/domain/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";
import { useAdd } from "../../add";
import { ShelfBar } from "../shelf-bar";
import { useMarkViewed } from "../../shelf-news";
import { ShelfCards } from "../shelf-cards";

// All groups (PRD F5.2): every group you're in, one card per title, each person once.
export function AllGroupsShelf({ groups, shelf }: { groups: SwitcherGroup[]; shelf: Shelf }) {
  const { openAdd } = useAdd();
  // Viewing All groups counts as viewing each group in it.
  useMarkViewed(groups.map((g) => g.id));
  return (
    <>
      <ShelfBar groups={groups} currentId="all" />
      <LiveShelf groupIds={groups.map((g) => g.id)} />
      <h1 className="text-title-l text-default">{t("groups.allGroups")}</h1>
      <ShelfCards
        cards={shelf.cards}
        services={shelf.services}
        scope={{ kind: "all", groupIds: groups.map((g) => g.id) }}
        empty={
          <EmptyState
            showShelf
            headingLevel={2}
            title={t("shelf.allEmptyTitle")}
            body={t("shelf.allEmptyBody")}
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
