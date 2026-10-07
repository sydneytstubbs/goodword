"use client";

import { RecCardDetail } from "@/components/domain/rec-card";
import type { ReactNode } from "react";
import { TitleGoodWords, type TitlePageGoodWord } from "@/components/domain/title-good-words";
import type { GoodWord, MyGoodWord, Title } from "@/components/domain/types";
import { VouchButton } from "@/components/domain/vouch-button";
import { t } from "@/lib/messages";
import { useAdd } from "../../../add";
import { useGoodWords } from "../../../good-words";

// Title detail (PRD F6, DS 4.2.2 `detail`): who in your groups vouched, yours
// first as "You", where to watch, and the vouch button, this screen's one
// primary action, then the conversation preview (DS 5.17). Your own good word,
// and the groups it's in, reflect pending changes at once.
//
// It's the title page (PRD F16.4): where to watch with
// the title, then every good word you can see (yours first, or the vouch
// button in its place), each with its conversation under it, then your groups'
// conversations, then the overview.
export function TitleDetail({
  title,
  goodWords,
  mine: serverMine,
  whereToWatch,
  conversation,
  overview,
  headingLevel = 1,
}: {
  title: Title;
  /** With the flag, each good word carries its id and conversation. */
  goodWords: GoodWord[] | TitlePageGoodWord[];
  mine: MyGoodWord | null;
  whereToWatch: ReactNode;
  conversation?: ReactNode;
  overview?: ReactNode;
  /** Beside a conversation on desktop, the conversation has the page's h1. */
  headingLevel?: 1 | 2;
}) {
  const { viewer, groups, friends, mineFor, takeBack } = useGoodWords();
  const { openAdd, openEditNote, openChangeGroups } = useAdd();
  const mine = mineFor(title.id, serverMine);
  const serverOwn = goodWords.find((g) => g.person.id === viewer.id);
  const others = goodWords.filter((g) => g.person.id !== viewer.id);
  const own: GoodWord | null = mine
    ? {
        ...serverOwn,
        person: viewer,
        ...(mine.note ? { note: mine.note } : { note: undefined }),
        at: new Date(mine.createdAt),
        groups: groups.filter((g) => mine.groupIds.includes(g.id)).map(({ id, name }) => ({ id, name })),
        // Shared with your friends (PRD F16.2).
        ...(friends && mine.friendsSharedAt ? { friends: true } : { friends: undefined }),
      }
    : null;
  const shown: GoodWord[] = own ? [own, ...others] : others;

  const vouchButton = (
    <VouchButton
      vouched={mine !== null}
      size="lg"
      emphasis="primary"
      onPut={() => openAdd({ title, entryPoint: "title" })}
      onEditNote={() => mine && openEditNote(title, mine)}
      onChangeGroups={() => mine && openChangeGroups(title, mine)}
      onTakeBack={() => mine && takeBack(title, mine)}
      withFriends={friends !== null}
    />
  );

  // The title page with friends (F16.4): good words that aren't confirmed yet
  // (just put in) have no id or conversation, so yours shows without one.
  const people =
    friends !== null ? (
      <TitleGoodWords
        title={title}
        goodWords={shown.map((g) => ({ goodWordId: `pending-${g.person.id}`, ...g }) as TitlePageGoodWord)}
        viewerId={viewer.id}
        vouchButton={vouchButton}
        noGoodWords={t("titleDetail.noGoodWordsFriends")}
        headingLevel={headingLevel === 1 ? 2 : 3}
      />
    ) : undefined;

  return (
    <RecCardDetail
      title={title}
      goodWords={shown}
      viewerId={viewer.id}
      noGoodWords={t("titleDetail.noGoodWords")}
      whereToWatch={whereToWatch}
      conversation={conversation}
      overview={overview}
      headingLevel={headingLevel}
      vouchButton={vouchButton}
      people={people}
    />
  );
}
