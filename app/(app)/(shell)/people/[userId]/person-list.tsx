"use client";

import type { List } from "@/components/domain/types";
import { Icon } from "@/components/icon";
import { GroupDot, type Group } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { joinList } from "@/lib/format";
import { t } from "@/lib/messages";
import { ListCards } from "../../list/list-cards";

// Person view (PRD F8): their name, the groups you share (and whether
// they're your friend), and their good words you can see, with the usual filters. The empty scope keeps your
// own pending good words off their list.
export function PersonList({ name, groups, friend = false, list }: { name: string; groups: Group[]; friend?: boolean; list: List }) {
  return (
    <>
      <header className="flex flex-col gap-2">
        <h1 className="text-title-l text-default break-words">{t("people.title", { name })}</h1>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted">
          {friend && (
            <span className="inline-flex items-center gap-1">
              <Icon name="friends" size={16} />
              {t("people.friend")}
            </span>
          )}
          {groups.length > 0 && <span>{t("people.shared", { groups: joinList(groups.map((g) => g.name)) })}</span>}
          <span aria-hidden="true" className="flex gap-1">
            {groups.map((g) => (
              <GroupDot key={g.id} group={g} />
            ))}
          </span>
        </p>
      </header>
      <ListCards
        cards={list.cards}
        services={list.services}
        scope={{ kind: "all", groupIds: [] }}
        empty={<EmptyState headingLevel={2} title={t("people.emptyTitle", { name })} body={friend ? t("people.emptyBodyFriend") : t("people.emptyBody")} />}
      />
    </>
  );
}
