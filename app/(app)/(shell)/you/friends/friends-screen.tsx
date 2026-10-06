"use client";

import { startTransition, useOptimistic, useState, type ReactNode } from "react";
import { FriendLinkCard } from "@/components/domain/friend-link-card";
import { PersonRow } from "@/components/domain/person-row";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import { cancelRequest, removeFriend, requestFriend, resetFriendLink, respondToRequest, type FriendResult } from "@/lib/friends/actions";
import type { FriendPerson, FriendsOverview } from "@/lib/friends/queries";
import { t } from "@/lib/messages";

// The Friends screen (PRD F16.1, DS 5.20). Every write is optimistic: the row
// moves at once, and if the save fails it moves back with a Retry toast
// (DS 5.10). Declining and cancelling are silent for the other person.

type Change =
  | { kind: "accept"; person: FriendPerson }
  | { kind: "decline"; person: FriendPerson }
  | { kind: "add"; person: FriendPerson }
  | { kind: "cancel"; person: FriendPerson }
  | { kind: "remove"; person: FriendPerson };

const without = <P extends FriendPerson>(list: P[], id: string) => list.filter((p) => p.id !== id);

function applyChange(view: FriendsOverview, change: Change): FriendsOverview {
  const { person } = change;
  switch (change.kind) {
    case "accept":
      return { ...view, incoming: without(view.incoming, person.id), friends: [...view.friends, person] };
    case "decline":
      return { ...view, incoming: without(view.incoming, person.id) };
    case "add":
      return { ...view, fromGroups: without(view.fromGroups, person.id), sent: [person, ...view.sent] };
    case "cancel":
      return { ...view, sent: without(view.sent, person.id) };
    case "remove":
      return { ...view, friends: without(view.friends, person.id) };
  }
}

export function FriendsScreen({ me, overview, link }: { me: FriendPerson; overview: FriendsOverview; link: string }) {
  const { showToast } = useToast();
  const [view, change] = useOptimistic(overview, applyChange);
  const [removing, setRemoving] = useState<FriendPerson | null>(null);
  const [resetting, setResetting] = useState(false);
  const [justReset, setJustReset] = useState(false);

  function run(next: Change, save: () => Promise<FriendResult>, success?: (result: FriendResult) => string | null) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      showToast({ message: t("friends.offline") });
      return;
    }
    startTransition(async () => {
      change(next);
      const result = await save().catch((): FriendResult => ({ ok: false }));
      if (!result.ok) {
        showToast({ message: t("friends.failed"), action: { label: t("common.retry"), onAction: () => run(next, save, success) } });
        return;
      }
      const message = success?.(result);
      if (message) showToast({ message });
    });
  }

  const accept = (person: FriendPerson) =>
    run({ kind: "accept", person }, () => respondToRequest(person.id, true), () => t("friends.nowFriends", { name: person.name }));
  const decline = (person: FriendPerson) => run({ kind: "decline", person }, () => respondToRequest(person.id, false));
  const add = (person: FriendPerson) =>
    run({ kind: "add", person }, () => requestFriend(person.id, "friends_screen"), (result) =>
      // If they'd already asked you, adding them makes you friends.
      result.status === "friends" ? t("friends.nowFriends", { name: person.name }) : t("friends.requestSent", { name: person.name }),
    );
  const cancel = (person: FriendPerson) => run({ kind: "cancel", person }, () => cancelRequest(person.id));

  function confirmRemove() {
    const person = removing;
    setRemoving(null);
    if (person) run({ kind: "remove", person }, () => removeFriend(person.id), () => t("friends.removed", { name: person.name }));
  }

  async function confirmReset() {
    setResetting(false);
    const result = await resetFriendLink().catch(() => ({ ok: false }));
    if (result.ok) setJustReset(true);
    else showToast({ message: t("friends.failed"), action: { label: t("common.retry"), onAction: confirmReset } });
  }

  const nobody = view.incoming.length + view.fromGroups.length + view.friends.length + view.sent.length === 0;

  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-8 px-4 py-8">
      <h1 className="text-title-l text-default">{t("friends.title")}</h1>
      <FriendLinkCard me={me} link={link} justReset={justReset} onReset={() => setResetting(true)} />

      {nobody && <EmptyState headingLevel={2} title={t("friends.emptyTitle")} body={t("friends.emptyBody")} />}

      <Section id="incoming" title={t("friends.incomingHeading")} people={view.incoming}>
        {(person) => <PersonRow key={person.id} person={person} variant="incoming" onAccept={() => accept(person)} onDecline={() => decline(person)} />}
      </Section>
      <Section id="from-groups" title={t("friends.fromGroupsHeading")} people={view.fromGroups}>
        {(person) => (
          <PersonRow
            key={person.id}
            person={person}
            variant="fromGroup"
            groupName={person.groupName}
            onAdd={() => add(person)}
          />
        )}
      </Section>
      <Section id="friends" title={t("friends.friendsHeading")} people={view.friends}>
        {(person) => <PersonRow key={person.id} person={person} variant="friend" onRemove={() => setRemoving(person)} />}
      </Section>
      <Section id="sent" title={t("friends.sentHeading")} people={view.sent}>
        {(person) => <PersonRow key={person.id} person={person} variant="sent" onCancel={() => cancel(person)} />}
      </Section>

      <Dialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? t("friends.removeTitle", { name: removing.name }) : ""}
        description={t("friends.removeBody")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={confirmRemove}>
              {t("friends.remove")}
            </Button>
          </>
        }
      />
      <Dialog
        open={resetting}
        onClose={() => setResetting(false)}
        title={t("friends.resetTitle")}
        description={t("friends.resetBody")}
        actions={
          <>
            <Button variant="secondary" onClick={() => setResetting(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="danger" onClick={confirmReset}>
              {t("friends.resetLink")}
            </Button>
          </>
        }
      />
    </main>
  );
}

/** A labeled list of people, hidden when it's empty (DS 5.20). */
function Section<P extends FriendPerson>({
  id,
  title,
  people,
  children,
}: {
  id: string;
  title: string;
  people: P[];
  children: (person: P) => ReactNode;
}) {
  if (people.length === 0) return null;
  return (
    <section aria-labelledby={`friends-${id}`} className="flex flex-col gap-1">
      <h2 id={`friends-${id}`} className="text-heading text-default">
        {title}
      </h2>
      <ul className="flex flex-col divide-y divide-subtle">{people.map(children)}</ul>
    </section>
  );
}
