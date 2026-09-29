import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { WhereToWatchSkeleton } from "@/components/domain/where-to-watch";
import type { TitleType } from "@/components/domain/types";
import { requireOnboardedUser } from "@/lib/auth/session";
import { titleGoodWords } from "@/lib/good-words/queries";
import { listMyGroups } from "@/lib/groups/queries";
import { safeRegion } from "@/lib/titles/providers";
import { getTitle, type CachedTitle } from "@/lib/titles/cache";
import { Overview } from "./overview";
import { TitleDetail } from "./title-detail";
import { WhereToWatch } from "./where-to-watch";
import { TitleUnavailable } from "./title-unavailable";

// Title detail (PRD F6), reachable for any title: everyone in your groups who
// vouched, with the chips of your groups each good word is in; where to watch
// in your region; the vouch button; the overview. The conversation preview
// arrives with step 6.

function parse(params: { type: string; tmdbId: string }): { type: TitleType; tmdbId: number } | null {
  if (params.type !== "movie" && params.type !== "tv") return null;
  if (!/^[1-9]\d{0,8}$/.test(params.tmdbId)) return null;
  return { type: params.type, tmdbId: Number(params.tmdbId) };
}

async function load(type: TitleType, tmdbId: number): Promise<{ title: CachedTitle | null } | { failed: true }> {
  try {
    return { title: await getTitle(type, tmdbId) };
  } catch {
    return { failed: true };
  }
}

export async function generateMetadata({ params }: PageProps<"/title/[type]/[tmdbId]">): Promise<Metadata> {
  const parsed = parse(await params);
  const result = parsed ? await load(parsed.type, parsed.tmdbId) : null;
  // "The Night Ferry · Good Word" (F6).
  return { title: result && "title" in result && result.title ? `${result.title.name} · Good Word` : "Good Word" };
}

export default async function TitlePage({ params }: PageProps<"/title/[type]/[tmdbId]">) {
  const raw = await params;
  const { user, profile } = await requireOnboardedUser(`/title/${raw.type}/${raw.tmdbId}`);
  const parsed = parse(raw);
  if (!parsed) notFound();

  const result = await load(parsed.type, parsed.tmdbId);
  if ("failed" in result) return <TitleUnavailable />;
  const title = result.title;
  if (!title) notFound();
  const groups = await listMyGroups(user.id);
  const { goodWords, mine } = await titleGoodWords(parsed.type, parsed.tmdbId, { id: user.id, name: profile.display_name }, groups);
  const { overview, ...card } = title;

  return (
    <main className="mx-auto flex w-full max-w-detail flex-col gap-8 px-4 pt-2 pb-12">
      <TitleDetail
        title={card}
        goodWords={goodWords}
        mine={mine}
        whereToWatch={
          <Suspense fallback={<WhereToWatchSkeleton />}>
            <WhereToWatch type={parsed.type} tmdbId={parsed.tmdbId} region={safeRegion(profile.region)} />
          </Suspense>
        }
        overview={overview ? <Overview text={overview} /> : undefined}
      />
    </main>
  );
}
