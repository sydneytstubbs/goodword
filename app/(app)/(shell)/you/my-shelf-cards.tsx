"use client";

import type { Shelf } from "@/components/domain/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";
import { useAdd } from "../add";
import { ShelfCards } from "../shelf/shelf-cards";

// Your own good words, including ones in no group (PRD F5.3). Each card says
// where it's shared, or "Only you".
export function MyShelfCards({ shelf }: { shelf: Shelf }) {
  const { openAdd } = useAdd();
  return (
    <ShelfCards
      cards={shelf.cards}
      services={shelf.services}
      scope={{ kind: "mine" }}
      empty={
        <EmptyState
          showShelf
          headingLevel={2}
          title={t("you.emptyTitle")}
          body={t("you.emptyBody")}
          action={
            <Button variant="primary" size="lg" icon="add" onClick={() => openAdd()}>
              {t("vouch.put")}
            </Button>
          }
        />
      }
    />
  );
}
