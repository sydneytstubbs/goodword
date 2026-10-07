import { Suspense, type ReactNode } from "react";
import { WhereToWatchSkeleton } from "@/components/domain/where-to-watch";
import type { TitleType } from "@/components/domain/types";
import { friendIds } from "@/lib/friends/queries";
import { titleGoodWords, titleGoodWordsWithFriends } from "@/lib/good-words/queries";
import { listMyGroups } from "@/lib/groups/queries";
import type { CachedTitle } from "@/lib/titles/cache";
import { safeRegion } from "@/lib/titles/providers";
import { Overview } from "./overview";
import { TitleDetail } from "./title-detail";
import { WhereToWatch } from "./where-to-watch";

// Title detail's content (PRD F6), on its own screen or beside a
// conversation on desktop (DS 5.17): everyone in your groups who vouched,
// where to watch in your region, the vouch button, the conversation preview,
// and the overview. With the home_enabled flag, the title page (F16.4): every
// good word you can see, friends' included, each with its conversation.
export async function TitleContent({
  type,
  tmdbId,
  title,
  viewer,
  region,
  conversation,
  headingLevel,
  home = false,
}: {
  type: TitleType;
  tmdbId: number;
  title: CachedTitle;
  viewer: { id: string; name: string };
  region: string;
  conversation?: ReactNode;
  headingLevel?: 1 | 2;
  /** The home_enabled flag (PRD F16.10). */
  home?: boolean;
}) {
  const groups = await listMyGroups(viewer.id);
  const { goodWords, mine } = home
    ? await titleGoodWordsWithFriends(type, tmdbId, viewer, groups, await friendIds(viewer.id))
    : await titleGoodWords(type, tmdbId, viewer, groups);
  const { overview, ...card } = title;
  return (
    <TitleDetail
      title={card}
      goodWords={goodWords}
      mine={mine}
      headingLevel={headingLevel}
      whereToWatch={
        <Suspense fallback={<WhereToWatchSkeleton />}>
          <WhereToWatch type={type} tmdbId={tmdbId} region={safeRegion(region)} fromGoodWord={goodWords.length > 0} />
        </Suspense>
      }
      conversation={conversation}
      overview={overview ? <Overview text={overview} /> : undefined}
    />
  );
}
