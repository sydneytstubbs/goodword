"use client";

import type { SwitcherGroup } from "@/components/domain/group-switcher";
import type { ShelfCard } from "@/components/domain/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";
import { useAdd } from "../../add";
import { ShelfBar } from "../shelf-bar";
import { ShelfCards } from "../shelf-cards";

// All groups (PRD F5.2): every group you're in, one card per title, each person once.
export function AllGroupsShelf({ groups, cards }: { groups: SwitcherGroup[]; cards: ShelfCard[] }) {
  const { openAdd } = useAdd();
  return (
    <>
      <ShelfBar groups={groups} currentId="all" />
      <h1 className="text-title-l text-default">{t("groups.allGroups")}</h1>
      <ShelfCards
        cards={cards}
        scope={{ kind: "all", groupIds: groups.map((g) => g.id) }}
        empty={
          <EmptyState
            showShelf
            headingLevel={2}
            title={t("shelf.allEmptyTitle")}
            body={t("shelf.allEmptyBody")}
            action={
              <Button variant="primary" size="lg" icon="add" onClick={() => openAdd()}>
                {t("vouch.put")}
              </Button>
            }
          />
        }
      />
    </>
  );
}
