import type { TitleType } from "@/components/domain/types";
import { WhereToWatchList } from "@/components/domain/where-to-watch";
import { cachedTitleId } from "@/lib/conversations/queries";
import { getWatchProviders } from "@/lib/titles/providers";
import { ProviderClicks } from "./provider-clicks";
import { WhereToWatchError } from "./where-to-watch-error";

// Where to watch in the viewer's region (PRD F6). Streams in after the rest
// of the title, so a slow TMDB never holds up who vouched. If it fails with
// nothing cached, only this region shows an error (DS 5.12, partial).
export async function WhereToWatch({
  type,
  tmdbId,
  region,
  fromGoodWord,
}: {
  type: TitleType;
  tmdbId: number;
  region: string;
  /** Friends have vouched for it, for measuring whether lists help people choose (H5). */
  fromGoodWord: boolean;
}) {
  const [providers, titleId] = await Promise.all([
    getWatchProviders(type, tmdbId, region).catch(() => null),
    cachedTitleId(type, tmdbId).catch(() => null),
  ]);
  if (!providers) return <WhereToWatchError />;
  return (
    <ProviderClicks titleId={titleId} fromGoodWord={fromGoodWord}>
      <WhereToWatchList providers={providers} />
    </ProviderClicks>
  );
}
