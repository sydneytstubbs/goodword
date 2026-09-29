import type { TitleType } from "@/components/domain/types";
import { WhereToWatchList } from "@/components/domain/where-to-watch";
import { getWatchProviders } from "@/lib/titles/providers";
import { WhereToWatchError } from "./where-to-watch-error";

// Where to watch in the viewer's region (PRD F6). Streams in after the rest
// of the title, so a slow TMDB never holds up who vouched. If it fails with
// nothing cached, only this region shows an error (DS 5.12, partial).
export async function WhereToWatch({ type, tmdbId, region }: { type: TitleType; tmdbId: number; region: string }) {
  const providers = await getWatchProviders(type, tmdbId, region).catch(() => null);
  return providers ? <WhereToWatchList providers={providers} /> : <WhereToWatchError />;
}
