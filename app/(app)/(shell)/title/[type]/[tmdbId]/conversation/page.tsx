import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { conversationHref } from "@/lib/conversations/paths";
import { cachedTitleId, conversationPreviews, defaultGroupId, loadConversation } from "@/lib/conversations/queries";
import { getGroup, listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { recordEvent } from "@/lib/events/server";
import { referrerPath } from "@/lib/events/referrer";
import { createClient } from "@/lib/supabase/server";
import { NotInGroup } from "../../../../not-in-group";
import { TitleContent } from "../title-content";
import { loadTitle, parseTitleParams } from "../title-params";
import { TitleUnavailable } from "../title-unavailable";
import { Conversation } from "./conversation";

// A group's conversation about a title (PRD F13, DS 5.17), for members of
// that group only: anyone else sees "You're not in this group" without the
// group's name (PRD 6.4). Any title can have one. On desktop it's a panel
// beside title detail.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/title/[type]/[tmdbId]/conversation">): Promise<Metadata> {
  const parsed = parseTitleParams(await params);
  const groupId = one((await searchParams).group);
  const result = parsed ? await loadTitle(parsed.type, parsed.tmdbId) : null;
  if (!result || !("title" in result) || !result.title || !groupId) return { title: "Good Word" };
  const { user } = await requireOnboardedUser(`/title/${parsed!.type}/${parsed!.tmdbId}`);
  const group = await getGroup(groupId, user.id);
  // "The Night Ferry · College crew · Good Word". A group you're not in is never named.
  return { title: group ? t("conversation.documentTitle", { title: result.title.name, group: group.name }) : "Good Word" };
}

export default async function ConversationPage({ params, searchParams }: PageProps<"/title/[type]/[tmdbId]/conversation">) {
  const raw = await params;
  const query = await searchParams;
  const groupParam = one(query.group);
  const commentParam = one(query.comment);
  const here = new URLSearchParams(
    Object.entries({ group: groupParam, comment: commentParam }).filter((e): e is [string, string] => Boolean(e[1])),
  );
  const { user, profile } = await requireOnboardedUser(`/title/${raw.type}/${raw.tmdbId}/conversation?${here}`);
  const parsed = parseTitleParams(raw);
  if (!parsed) notFound();

  const result = await loadTitle(parsed.type, parsed.tmdbId);
  if ("failed" in result) return <TitleUnavailable />;
  const title = result.title;
  if (!title) notFound();
  const [groups, titleId] = await Promise.all([listMyGroups(user.id), cachedTitleId(parsed.type, parsed.tmdbId)]);
  if (!titleId) return <TitleUnavailable />;

  // No group picked: the likeliest one (DS 5.17). In no groups: title detail.
  if (!groupParam) {
    if (groups.length === 0) redirect(`/title/${parsed.type}/${parsed.tmdbId}`);
    const previews = await conversationPreviews(titleId, groups, user.id).catch(() => null);
    const fallback = (previews && defaultGroupId(previews)) ?? groups[0].id;
    redirect(conversationHref(title, fallback, { compose: one(query.compose) === "1" }));
  }

  const summary = groups.find((g) => g.id === groupParam);
  const group = summary && UUID.test(groupParam) ? await getGroup(groupParam, user.id) : null;
  if (!summary || !group) return <NotInGroup />;

  const supabase = await createClient();
  const [page, hint] = await Promise.all([
    loadConversation(group.id, titleId, user.id, commentParam && UUID.test(commentParam) ? commentParam : undefined).catch(() => null),
    supabase.from("profiles").select("spoiler_hint_seen_at").eq("user_id", user.id).maybeSingle(),
  ]);
  const linked = commentParam && page?.comments.some((c) => c.id === commentParam) ? commentParam : undefined;

  // Where it was opened from, and how much was new (PRD 11.2, H7).
  const came = await referrerPath();
  const from =
    one(query.ref) === "mention"
      ? "email"
      : came?.startsWith("/activity")
        ? "activity"
        : came && /^\/title\/(movie|tv)\/\d+$/.test(came)
          ? "title"
          : came && /^\/(shelf|you)(\/|$)/.test(came)
            ? "card"
            : undefined;
  const firstUnseen = page?.firstUnseenId ? page.comments.findIndex((c) => c.id === page.firstUnseenId) : -1;
  const unseen = firstUnseen < 0 ? 0 : page!.comments.slice(firstUnseen).filter((c) => c.author.id !== user.id).length;
  await recordEvent("conversation_opened", { group_id: group.id, title_id: titleId, unseen_count: unseen, ...(from ? { from } : {}) }, user.id);

  return (
    <main className="lg:flex lg:items-start">
      {/* Beside the conversation on desktop, title detail stays in view (DS 5.17). */}
      <div className="hidden min-w-0 flex-1 px-4 pt-8 pb-12 lg:block">
        <div className="mx-auto max-w-detail">
          <TitleContent
            type={parsed.type}
            tmdbId={parsed.tmdbId}
            title={title}
            viewer={{ id: user.id, name: profile.display_name }}
            region={profile.region}
            headingLevel={2}
          />
        </div>
      </div>
      <Conversation
        key={`${group.id}:${titleId}`}
        title={title}
        titleId={titleId}
        group={{ id: group.id, name: group.name, memberCount: group.members.length }}
        members={group.members.map((m) => ({ id: m.id, name: m.name }))}
        viewer={{ id: user.id, name: profile.display_name }}
        viewerIsOwner={group.me.role === "owner"}
        initial={page}
        linkedCommentId={linked}
        compose={one(query.compose) === "1"}
        showSpoilerHint={!hint.data?.spoiler_hint_seen_at}
        backHref={`/title/${parsed.type}/${parsed.tmdbId}?group=${group.id}`}
      />
    </main>
  );
}
