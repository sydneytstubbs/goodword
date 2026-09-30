"use client";

import type { Shelf } from "@/components/domain/types";
import { GroupDot, type Group } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { joinList } from "@/lib/format";
import { t } from "@/lib/messages";
import { ShelfCards } from "../../shelf/shelf-cards";

// Person view (PRD F8): their name, the groups you share, and their good
// words in those groups, with the usual filters. The empty scope keeps your
// own pending good words off their shelf.
export function PersonShelf({ name, groups, shelf }: { name: string; groups: Group[]; shelf: Shelf }) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-title-l text-default break-words">{t("people.title", { name })}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          <span>{t("people.shared", { groups: joinList(groups.map((g) => g.name)) })}</span>
          <span aria-hidden="true" className="flex gap-1">
            {groups.map((g) => (
              <GroupDot key={g.id} group={g} />
            ))}
          </span>
        </p>
      </header>
      <ShelfCards
        cards={shelf.cards}
        services={shelf.services}
        scope={{ kind: "all", groupIds: [] }}
        empty={<EmptyState headingLevel={2} title={t("people.emptyTitle", { name })} body={t("people.emptyBody")} />}
      />
    </>
  );
}
