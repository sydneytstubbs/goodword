"use client";

import { useState } from "react";
import { PersonRow } from "@/components/domain/person-row";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { dismissFriendPrompt, requestFriend } from "@/lib/friends/actions";
import type { FriendPerson } from "@/lib/friends/queries";
import { t } from "@/lib/messages";

// After joining a group (PRD F16.1, DS 5.20): one inline card offering to add
// the people here you're not friends with yet. Skippable, never automatic,
// and gone for this group once dismissed.
export function FriendPrompt({ groupId, groupName, people }: { groupId: string; groupName: string; people: FriendPerson[] }) {
  const { showToast } = useToast();
  const [gone, setGone] = useState(false);
  const [asked, setAsked] = useState<Set<string>>(new Set());

  function add(person: FriendPerson) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showToast({ message: t("friends.offline") });
      return;
    }
    setAsked((a) => new Set(a).add(person.id));
    requestFriend(person.id, "group_prompt")
      .catch(() => ({ ok: false }))
      .then((result) => {
        if (result.ok) return;
        setAsked((a) => {
          const next = new Set(a);
          next.delete(person.id);
          return next;
        });
        showToast({ message: t("friends.failed"), action: { label: t("common.retry"), onAction: () => add(person) } });
      });
  }

  function dismiss() {
    setGone(true);
    void dismissFriendPrompt(groupId);
  }

  if (gone || people.length === 0) return null;
  return (
    <aside
      aria-label={t("friends.promptLabel", { group: groupName })}
      className="flex flex-col gap-2 rounded-card border border-subtle bg-surface-raised p-5 shadow-sm fc-edge"
    >
      <p className="text-heading text-default">{t("friends.promptTitle")}</p>
      <ul className="flex flex-col divide-y divide-subtle">
        {people.map((person) =>
          asked.has(person.id) ? (
            <PersonRow key={person.id} person={person} variant="sent" />
          ) : (
            <PersonRow key={person.id} person={person} variant="fromGroup" onAdd={() => add(person)} />
          ),
        )}
      </ul>
      <Button variant="ghost" className="self-start" onClick={dismiss}>
        {t("friends.promptNotNow")}
      </Button>
    </aside>
  );
}
