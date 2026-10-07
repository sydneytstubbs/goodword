import { Suspense, type ReactNode } from "react";
import { WhereToWatchSkeleton } from "@/components/domain/where-to-watch";
import type { TitleType } from "@/components/domain/types";
import { friendIds } from "@/lib/friends/queries";
import { titleGoodWordsWithFriends } from "@/lib/good-words/queries";
import { listMyGroups } from "@/lib/groups/queries";
import type { CachedTitle } from "@/lib/titles/cache";
import { safeRegion } from "@/lib/titles/providers";
import { Overview } from "./overview";
import { TitleDetail } from "./title-detail";
import { WhereToWatch } from "./where-to-watch";

// The title page's content (PRD F16.4), on its own screen or beside a
// conversation on desktop (DS 5.17): where to watch in your region, every good
// word you can see (friends' included) with its conversation, the vouch
// button, your groups' conversations, and the overview.
export async function TitleContent({
  type,
  tmdbId,
  title,
  viewer,
  region,
  conversation,
  headingLevel,
}: {
  type: TitleType;
  tmdbId: number;
  title: CachedTitle;
  viewer: { id: string; name: string };
  region: string;
  conversation?: ReactNode;
  headingLevel?: 1 | 2;
}) {
  const groups = await listMyGroups(viewer.id);
  const { goodWords, mine } = await titleGoodWordsWithFriends(type, tmdbId, viewer, groups, await friendIds(viewer.id));
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
