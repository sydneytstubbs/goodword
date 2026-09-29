"use client";

import { useState } from "react";
import { ActivityItem, type ActivityKind } from "@/components/domain/activity-item";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { activitySection, type ActivityEntry, type ActivitySection } from "@/lib/conversations/activity";
import { markActivityRead, markAllActivityRead } from "@/lib/conversations/actions";
import { plainText } from "@/lib/conversations/body";
import { conversationHref } from "@/lib/conversations/paths";
import { nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { useActivityCount } from "../activity-count";

// The Activity list (DS 4.2.13, 5.17): grouped by Today, This week, and
// Earlier. Each item links to the exact comment (or the group, for joins);
// opening one marks it read. "Mark all as read" sits at the top while
// anything is unread.

const kinds: Record<ActivityEntry["type"], ActivityKind> = {
  mention: "mention",
  comment: "comment",
  conversation_started: "started",
  group_join: "join",
};

const sections: ActivitySection[] = ["today", "week", "earlier"];

function hrefFor(entry: ActivityEntry): string {
  if (entry.type === "group_join" || !entry.title) return `/groups/${entry.group.id}`;
  return conversationHref(entry.title, entry.group.id, entry.commentId ? { comment: entry.commentId } : {});
}

export function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  const { showToast } = useToast();
  const { refresh } = useActivityCount();
  const [read, setRead] = useState<Set<string>>(new Set());
  const [allRead, setAllRead] = useState(false);
  const unread = (entry: ActivityEntry) => entry.unread && !allRead && !read.has(entry.key);
  const anyUnread = entries.some(unread);

  function open(entry: ActivityEntry) {
    if (!unread(entry)) return;
    setRead((r) => new Set(r).add(entry.key));
    markActivityRead(entry.ids).then(refresh, () => {});
  }

  function markAll() {
    setAllRead(true);
    markAllActivityRead()
      .catch(() => false)
      .then((ok) => {
        if (ok) refresh();
        else {
          setAllRead(false);
          showToast({ message: t("activityScreen.didntSave"), action: { label: t("common.retry"), onAction: markAll } });
        }
      });
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-title-l text-default">{t("activityScreen.title")}</h1>
        {anyUnread && (
          <Button variant="secondary" size="sm" onClick={markAll}>
            {t("activityScreen.markAllRead")}
          </Button>
        )}
      </div>
      {entries.length === 0 ? (
        <EmptyState headingLevel={2} title={t("activityScreen.emptyTitle")} body={t("activityScreen.emptyBody")} />
      ) : (
        sections.map((section) => {
          const inSection = entries.filter((e) => activitySection(e.at) === section);
          if (inSection.length === 0) return null;
          return (
            <section key={section} aria-labelledby={`activity-${section}`} className="flex flex-col gap-2">
              <h2 id={`activity-${section}`} className="text-overline text-muted uppercase">
                {t(`activityScreen.${section}`)}
              </h2>
              <ul className="-mx-4 border-t border-subtle md:mx-0">
                {inSection.map((entry) => (
                  <li key={entry.key}>
                    <ActivityItem
                      kind={kinds[entry.type]}
                      actor={entry.actors[0]}
                      actorNames={entry.actors.length > 1 ? nameList(entry.actors.map((a) => a.name)) : undefined}
                      title={entry.title}
                      group={entry.group}
                      quote={entry.quote ? plainText(entry.quote) : undefined}
                      spoiler={entry.spoiler && entry.type !== "group_join"}
                      at={entry.at}
                      unread={unread(entry)}
                      href={hrefFor(entry)}
                      onOpen={() => open(entry)}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })
      )}
    </>
  );
}
