import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/session";
import { conversationHref } from "@/lib/conversations/paths";
import { cachedTitleId, conversationPreviews, defaultGroupId, loadConversation, wordConversation, wordMentionPeople } from "@/lib/conversations/queries";
import type { ConversationPage } from "@/lib/conversations/types";
import type { Title, TitleType } from "@/components/domain/types";
import { getGroup, listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { recordEvent } from "@/lib/events/server";
import { referrerPath } from "@/lib/events/referrer";
import { createClient } from "@/lib/supabase/server";
import { NotInGroup } from "../../../../not-in-group";
import { TitleContent } from "../title-content";
import { loadTitle, parseTitleParams } from "../title-params";
import { TitleUnavailable } from "../title-unavailable";
import { Conversation, type ConversationPlace } from "./conversation";

// A group's conversation about a title (PRD F13, DS 5.17), for members of
// that group only: anyone else sees "You're not in this group" without the
// group's name (PRD 6.4). Any title can have one. Or, with ?word= and the
// home_enabled flag, the conversation under a good word (F16.5), for everyone
// who can see that good word; anyone else gets a plain 404 (F16.6 rule 4).
// On desktop it's a panel beside title detail.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export async function generateMetadata({ params, searchParams }: PageProps<"/title/[type]/[tmdbId]/conversation">): Promise<Metadata> {
  const parsed = parseTitleParams(await params);
  const query = await searchParams;
  const groupId = one(query.group);
  const wordId = one(query.word);
  const result = parsed ? await loadTitle(parsed.type, parsed.tmdbId) : null;
  if (!result || !("title" in result) || !result.title || !(groupId || wordId)) return { title: "Good Word" };
  const { user, profile } = await requireOnboardedUser(`/title/${parsed!.type}/${parsed!.tmdbId}`);
  if (!groupId && wordId) {
    const word = profile.home_enabled && UUID.test(wordId) ? await wordConversation(wordId).catch(() => null) : null;
    return { title: word ? t("conversation.wordDocumentTitle", { title: result.title.name, name: word.author.name }) : "Good Word" };
  }
  if (!groupId) return { title: "Good Word" };
  const group = await getGroup(groupId, user.id);
  // "The Night Ferry · College crew · Good Word". A group you're not in is never named.
  return { title: group ? t("conversation.documentTitle", { title: result.title.name, group: group.name }) : "Good Word" };
}

export default async function ConversationPage({ params, searchParams }: PageProps<"/title/[type]/[tmdbId]/conversation">) {
  const raw = await params;
  const query = await searchParams;
  const groupParam = one(query.group);
  const wordParam = groupParam ? undefined : one(query.word);
  const commentParam = one(query.comment);
  const here = new URLSearchParams(
    Object.entries({ group: groupParam, word: wordParam, comment: commentParam }).filter((e): e is [string, string] => Boolean(e[1])),
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

  // Under a good word (F16.5): only with the flag, and only for people who can see it.
  if (wordParam) {
    if (!profile.home_enabled || !UUID.test(wordParam)) notFound();
    const word = await wordConversation(wordParam);
    if (!word || word.titleId !== titleId) notFound();
    const key = { kind: "word" as const, goodWordId: word.goodWordId, titleId };
    const [page, people, hint] = await Promise.all([
      loadConversation(key, user.id, commentParam && UUID.test(commentParam) ? commentParam : undefined).catch(() => null),
      wordMentionPeople(word.goodWordId).catch(() => []),
      createClient().then((supabase) => supabase.from("profiles").select("spoiler_hint_seen_at").eq("user_id", user.id).maybeSingle()),
    ]);
    await recordOpened(page, user.id, { scope: "good_word", title_id: titleId }, one(query.ref));
    return (
      <ConversationScreen
        parsed={parsed}
        title={title}
        titleId={titleId}
        viewer={{ id: user.id, name: profile.display_name }}
        region={profile.region}
        place={{ kind: "word", goodWordId: word.goodWordId, author: word.author }}
        members={people}
        page={page}
        commentParam={commentParam}
        compose={one(query.compose) === "1"}
        showSpoilerHint={!hint.data?.spoiler_hint_seen_at}
        backHref={`/title/${parsed.type}/${parsed.tmdbId}`}
      />
    );
  }

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
    loadConversation({ kind: "group", groupId: group.id, titleId }, user.id, commentParam && UUID.test(commentParam) ? commentParam : undefined).catch(
      () => null,
    ),
    supabase.from("profiles").select("spoiler_hint_seen_at").eq("user_id", user.id).maybeSingle(),
  ]);
  await recordOpened(page, user.id, { scope: "group", group_id: group.id, title_id: titleId }, one(query.ref));

  return (
    <ConversationScreen
      parsed={parsed}
      title={title}
      titleId={titleId}
      viewer={{ id: user.id, name: profile.display_name }}
      region={profile.region}
      place={{ kind: "group", group: { id: group.id, name: group.name, memberCount: group.members.length }, viewerIsOwner: group.me.role === "owner" }}
      members={group.members.map((m) => ({ id: m.id, name: m.name }))}
      page={page}
      commentParam={commentParam}
      compose={one(query.compose) === "1"}
      showSpoilerHint={!hint.data?.spoiler_hint_seen_at}
      backHref={`/title/${parsed.type}/${parsed.tmdbId}?group=${group.id}`}
    />
  );
}

/** Where it was opened from, and how much was new (PRD 11.2, H7). */
async function recordOpened(
  page: ConversationPage | null,
  viewerId: string,
  where: { scope: "group" | "good_word"; group_id?: string; title_id: string },
  ref: string | undefined,
) {
  const came = await referrerPath();
  const from =
    ref === "mention"
      ? "email"
      : came?.startsWith("/activity")
        ? "activity"
        : came && /^\/title\/(movie|tv)\/\d+$/.test(came)
          ? "title"
          : came && /^\/(list|you|home)(\/|$)/.test(came)
            ? "card"
            : undefined;
  const firstUnseen = page?.firstUnseenId ? page.comments.findIndex((c) => c.id === page.firstUnseenId) : -1;
  const unseen = firstUnseen < 0 ? 0 : page!.comments.slice(firstUnseen).filter((c) => c.author.id !== viewerId).length;
  await recordEvent("conversation_opened", { ...where, unseen_count: unseen, ...(from ? { from } : {}) }, viewerId);
}

/** Title detail beside the conversation on desktop; the conversation on its own on phones (DS 5.17). */
function ConversationScreen({
  parsed,
  title,
  titleId,
  viewer,
  region,
  place,
  members,
  page,
  commentParam,
  compose,
  showSpoilerHint,
  backHref,
}: {
  parsed: { type: TitleType; tmdbId: number };
  title: Title;
  titleId: string;
  viewer: { id: string; name: string };
  region: string;
  place: ConversationPlace;
  members: Array<{ id: string; name: string }>;
  page: ConversationPage | null;
  commentParam?: string;
  compose: boolean;
  showSpoilerHint: boolean;
  backHref: string;
}) {
  const linked = commentParam && page?.comments.some((c) => c.id === commentParam) ? commentParam : undefined;
  return (
    <main className="lg:flex lg:items-start">
      {/* Beside the conversation on desktop, title detail stays in view (DS 5.17). */}
      <div className="hidden min-w-0 flex-1 px-4 pt-8 pb-12 lg:block">
        <div className="mx-auto max-w-detail">
          <TitleContent type={parsed.type} tmdbId={parsed.tmdbId} title={title} viewer={viewer} region={region} headingLevel={2} />
        </div>
      </div>
      <Conversation
        key={place.kind === "group" ? `${place.group.id}:${titleId}` : place.goodWordId}
        title={title}
        titleId={titleId}
        place={place}
        members={members}
        viewer={viewer}
        initial={page}
        linkedCommentId={linked}
        compose={compose}
        showSpoilerHint={showSpoilerHint}
        backHref={backHref}
      />
    </main>
  );
}
