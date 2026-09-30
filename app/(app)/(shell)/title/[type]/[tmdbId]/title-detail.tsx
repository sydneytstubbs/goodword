"use client";

import { RecCardDetail } from "@/components/domain/rec-card";
import type { ReactNode } from "react";
import type { GoodWord, MyGoodWord, Title } from "@/components/domain/types";
import { VouchButton } from "@/components/domain/vouch-button";
import { t } from "@/lib/messages";
import { useAdd } from "../../../add";
import { useGoodWords } from "../../../good-words";

// Title detail (PRD F6, DS 4.2.2 `detail`): who in your groups vouched, yours
// first as "You", where to watch, and the vouch button, this screen's one
// primary action, then the conversation preview (DS 5.17). Your own good word,
// and the groups it's in, reflect pending changes at once.
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
  goodWords: GoodWord[];
  mine: MyGoodWord | null;
  whereToWatch: ReactNode;
  conversation?: ReactNode;
  overview?: ReactNode;
  /** Beside a conversation on desktop, the conversation has the page's h1. */
  headingLevel?: 1 | 2;
}) {
  const { viewer, groups, mineFor, takeBack } = useGoodWords();
  const { openAdd, openEditNote, openChangeGroups } = useAdd();
  const mine = mineFor(title.id, serverMine);
  const others = goodWords.filter((g) => g.person.id !== viewer.id);
  const shown: GoodWord[] = mine
    ? [
        {
          person: viewer,
          ...(mine.note ? { note: mine.note } : {}),
          at: new Date(mine.createdAt),
          groups: groups.filter((g) => mine.groupIds.includes(g.id)).map(({ id, name }) => ({ id, name })),
        },
        ...others,
      ]
    : others;

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
      vouchButton={
        <VouchButton
          vouched={mine !== null}
          size="lg"
          emphasis="primary"
          onPut={() => openAdd({ title, entryPoint: "title" })}
          onEditNote={() => mine && openEditNote(title, mine)}
          onChangeGroups={() => mine && openChangeGroups(title, mine)}
          onTakeBack={() => mine && takeBack(title, mine)}
        />
      }
    />
  );
}
