"use client";

import type { List } from "@/components/domain/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";
import { useAdd } from "../add";
import { ListCards } from "../list/list-cards";

// Your own good words, including ones in no group (PRD F5.3). Each card says
// where it's shared, or "Only you".
export function MyListCards({ list }: { list: List }) {
  const { openAdd } = useAdd();
  return (
    <ListCards
      cards={list.cards}
      services={list.services}
      scope={{ kind: "mine" }}
      empty={
        <EmptyState
          showList
          headingLevel={2}
          title={t("you.emptyTitle")}
          body={t("you.emptyBody")}
          action={
            <Button variant="primary" size="lg" icon="add" onClick={() => openAdd({ entryPoint: "empty_state" })}>
              {t("vouch.put")}
            </Button>
          }
        />
      }
    />
  );
}
