"use client";

import { useState } from "react";
import { ActivityItem, type ActivityKind } from "@/components/domain/activity-item";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { activitySection, type ActivityEntry, type ActivitySection } from "@/lib/conversations/activity";
import { markActivityRead, markAllActivityRead } from "@/lib/conversations/actions";
import { respondToRequest } from "@/lib/friends/actions";
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
  friend_request: "friendRequest",
  friend_accepted: "friendAccepted",
};

const sections: ActivitySection[] = ["today", "week", "earlier"];

function hrefFor(entry: ActivityEntry): string | undefined {
  if (entry.type === "friend_request") return undefined;
  if (entry.type === "friend_accepted" || !entry.group) return "/you/friends";
  if (entry.type === "group_join" || !entry.title) return `/groups/${entry.group.id}`;
  return conversationHref(entry.title, entry.group.id, entry.commentId ? { comment: entry.commentId } : {});
}

export function ActivityList({ entries }: { entries: ActivityEntry[] }) {
  const { showToast } = useToast();
  const { refresh } = useActivityCount();
  const [read, setRead] = useState<Set<string>>(new Set());
  const [allRead, setAllRead] = useState(false);
  // Friend requests answered here leave the list at once (PRD F16.1).
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const unread = (entry: ActivityEntry) => entry.unread && !allRead && !read.has(entry.key);
  const visible = entries.filter((e) => !answered.has(e.key));
  const anyUnread = visible.some(unread);

  function open(entry: ActivityEntry) {
    if (!unread(entry)) return;
    setRead((r) => new Set(r).add(entry.key));
    markActivityRead(entry.ids).then(refresh, () => {});
  }

  function answer(entry: ActivityEntry, accept: boolean) {
    const person = entry.actors[0];
    setAnswered((a) => new Set(a).add(entry.key));
    respondToRequest(person.id, accept)
      .catch(() => ({ ok: false }))
      .then((result) => {
        if (result.ok) {
          refresh();
          if (accept) showToast({ message: t("friends.nowFriends", { name: person.name }) });
          return;
        }
        setAnswered((a) => {
          const next = new Set(a);
          next.delete(entry.key);
          return next;
        });
        showToast({ message: t("friends.failed"), action: { label: t("common.retry"), onAction: () => answer(entry, accept) } });
      });
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
      {visible.length === 0 ? (
        <EmptyState headingLevel={2} title={t("activityScreen.emptyTitle")} body={t("activityScreen.emptyBody")} />
      ) : (
        sections.map((section) => {
          const inSection = visible.filter((e) => activitySection(e.at) === section);
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
                      group={entry.group ?? undefined}
                      quote={entry.quote ? plainText(entry.quote) : undefined}
                      spoiler={entry.spoiler && entry.type !== "group_join"}
                      at={entry.at}
                      unread={unread(entry)}
                      href={hrefFor(entry)}
                      onOpen={() => open(entry)}
                      actions={
                        entry.type === "friend_request" ? (
                          <>
                            <Button
                              variant="secondary"
                              aria-label={t("friends.acceptName", { name: entry.actors[0].name })}
                              onClick={() => answer(entry, true)}
                            >
                              {t("friends.accept")}
                            </Button>
                            <Button
                              variant="ghost"
                              aria-label={t("friends.declineName", { name: entry.actors[0].name })}
                              onClick={() => answer(entry, false)}
                            >
                              {t("friends.decline")}
                            </Button>
                          </>
                        ) : undefined
                      }
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
