import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireOnboardedUser } from "@/lib/auth/session";
import { cachedTitleId } from "@/lib/conversations/queries";
import { recordEvent } from "@/lib/events/server";
import { referrerPath } from "@/lib/events/referrer";
import { listMyGroups } from "@/lib/groups/queries";
import { ConversationPreviewSkeleton } from "@/components/domain/conversation-preview";
import { ConversationPreviewLoader } from "./conversation-preview-loader";
import { TitleContent } from "./title-content";
import { loadTitle, parseTitleParams } from "./title-params";
import { TitleUnavailable } from "./title-unavailable";

// Title detail (PRD F6), reachable for any title: everyone in your groups who
// vouched, with the chips of your groups each good word is in; where to watch
// in your region; the vouch button; the conversation preview for the group in
// `?group=` or the likeliest one (DS 5.17); the overview. With the
// home_enabled flag it's the title page (F16.4): one URL for everyone, showing
// only what each viewer may see (F16.6).

export async function generateMetadata({ params }: PageProps<"/title/[type]/[tmdbId]">): Promise<Metadata> {
  const parsed = parseTitleParams(await params);
  const result = parsed ? await loadTitle(parsed.type, parsed.tmdbId) : null;
  // "The Night Ferry · Good Word" (F6).
  return { title: result && "title" in result && result.title ? `${result.title.name} · Good Word` : "Good Word" };
}

export default async function TitlePage({ params, searchParams }: PageProps<"/title/[type]/[tmdbId]">) {
  const raw = await params;
  const { user, profile } = await requireOnboardedUser(`/title/${raw.type}/${raw.tmdbId}`);
  const parsed = parseTitleParams(raw);
  if (!parsed) notFound();

  const result = await loadTitle(parsed.type, parsed.tmdbId);
  if ("failed" in result) return <TitleUnavailable />;
  const title = result.title;
  if (!title) notFound();
  const [groups, titleId, query] = await Promise.all([listMyGroups(user.id), cachedTitleId(parsed.type, parsed.tmdbId), searchParams]);
  const asked = typeof query.group === "string" ? query.group : null;
  // Where the view came from (PRD 11.2): a digest link, or a list.
  const came = await referrerPath();
  const from = query.ref === "digest" ? "digest" : came && /^\/(list|you|home)(\/|$)/.test(came) ? "list" : undefined;
  await recordEvent("title_viewed", from ? { from } : {}, user.id);

  return (
    <main className="mx-auto flex w-full max-w-detail flex-col gap-8 px-4 pt-2 pb-12">
      <TitleContent
        type={parsed.type}
        tmdbId={parsed.tmdbId}
        title={title}
        viewer={{ id: user.id, name: profile.display_name }}
        region={profile.region}
        home={profile.home_enabled}
        conversation={
          groups.length > 0 ? (
            <Suspense fallback={<ConversationPreviewSkeleton />}>
              <ConversationPreviewLoader title={title} titleId={titleId} groups={groups} viewerId={user.id} askedGroupId={asked} />
            </Suspense>
          ) : undefined
        }
      />
    </main>
  );
}
