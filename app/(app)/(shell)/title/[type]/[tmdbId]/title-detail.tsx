"use client";

import { RecCardDetail } from "@/components/domain/rec-card";
import type { GoodWord, MyGoodWord, Title } from "@/components/domain/types";
import { VouchButton } from "@/components/domain/vouch-button";
import { t } from "@/lib/messages";
import { useAdd } from "../../../add";
import { useGoodWords } from "../../../good-words";

// Title detail (PRD F6, DS 4.2.2 `detail`): who in your groups vouched, yours
// first as "You", and the vouch button, this screen's one primary action.
// Your own good word reflects pending changes at once. Where to watch and the
// conversation preview arrive in steps 5 and 6.
export function TitleDetail({
  title,
  goodWords,
  mine: serverMine,
}: {
  title: Title;
  goodWords: GoodWord[];
  mine: MyGoodWord | null;
}) {
  const { viewer, mineFor, takeBack } = useGoodWords();
  const { openAdd, openEditNote, openChangeGroups } = useAdd();
  const mine = mineFor(title.id, serverMine);
  const others = goodWords.filter((g) => g.person.id !== viewer.id);
  const shown: GoodWord[] = mine
    ? [{ person: viewer, ...(mine.note ? { note: mine.note } : {}), at: new Date(mine.createdAt) }, ...others]
    : others;

  return (
    <RecCardDetail
      title={title}
      goodWords={shown}
      viewerId={viewer.id}
      noGoodWords={t("titleDetail.noGoodWords")}
      vouchButton={
        <VouchButton
          vouched={mine !== null}
          size="lg"
          emphasis="primary"
          onPut={() => openAdd({ title })}
          onEditNote={() => mine && openEditNote(title, mine)}
          onChangeGroups={() => mine && openChangeGroups(title, mine)}
          onTakeBack={() => mine && takeBack(title, mine)}
        />
      }
    />
  );
}
