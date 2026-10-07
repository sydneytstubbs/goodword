import "server-only";
import { cache } from "react";
import type { CardConversation, GoodWord, GoodWordSource, Group, LatestComment, MyGoodWord, Person, Service, List, ListCard, Title, TitleType } from "@/components/domain/types";
import { decodeBody, plainText } from "@/lib/conversations/body";
import { commentCounts, toComment, type CommentRow } from "@/lib/conversations/queries";
import type { WordConversationPreview } from "@/lib/conversations/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTitle } from "@/lib/titles/cache";
import { safeRegion, listProviders } from "@/lib/titles/providers";
import { recordToTitle, titleKey, type TitleRecord } from "@/lib/tmdb/normalize";
import { cardsFromCardRows, type CardRow } from "./list";

// Good word reads (PRD F4, F5, F6). Everything here runs as the signed-in
// user, under row-level security: someone else's good word shows only if it's
// on a list the viewer is on, with only the viewer's groups (PRD 8).

type Supabase = Awaited<ReturnType<typeof createClient>>;

export const TITLE_COLUMNS = "id, tmdb_id, media_type, title, year, poster_path, genres, runtime_minutes, seasons, accent";

type TitleRow = Omit<TitleRecord, "overview" | "original_title"> & { id: string };

const toTitle = (row: TitleRow): Title => recordToTitle(row);

async function names(supabase: Supabase, userIds: string[]): Promise<Map<string, string>> {
  const ids = [...new Set(userIds)];
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
  return new Map((data ?? []).map((p) => [p.user_id as string, (p.display_name as string | null) ?? ""]));
}

/** Cards with their streaming services in the viewer's region, and every service on the list. */
async function withServices(cards: ListCard[], rowIds: Map<string, string>, region: string): Promise<List> {
  const refs = cards.flatMap((c) => {
    const rowId = rowIds.get(c.title.id);
    return rowId && c.title.tmdbId ? [{ rowId, type: c.title.type, tmdbId: c.title.tmdbId }] : [];
  });
  const providers = await listProviders(refs, safeRegion(region));
  const services = new Map<number, Service>();
  const withIds = cards.map((card) => {
    const found = providers.get(rowIds.get(card.title.id) ?? "");
    if (!found) return card;
    for (const p of found.stream) services.set(p.id, { id: p.id, name: p.name });
    return { ...card, services: found.stream.map((p) => p.id) };
  });
  return { cards: withIds, services: [...services.values()] };
}

type CardScope =
  | { kind: "group"; groupId: string }
  | { kind: "groups" }
  | { kind: "mine" }
  | { kind: "person"; userId: string }
  | { kind: "home" };

type TitleCardRow = TitleRow & {
  vouchers: CardRow["vouchers"];
  latest_at: string;
  is_new: boolean;
  group_ids: string[] | null;
  friends: boolean | null;
  via_group: string | null;
};

/**
 * The one card query (PRD F16.11): title_cards builds every list's cards in
 * the database, under row-level security. Returns the cards and, by card,
 * the title's row id (for comment counts and streaming services).
 */
async function titleCards(scope: CardScope): Promise<{ cards: ListCard[]; rowIds: Map<string, string> }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("title_cards", {
    p_scope: scope.kind,
    ...(scope.kind === "group" ? { p_group: scope.groupId } : {}),
    ...(scope.kind === "person" ? { p_person: scope.userId } : {}),
  });
  if (error) throw new Error(`title cards (${scope.kind}): ${error.code}`);
  const rows = (data ?? []) as TitleCardRow[];
  const cards = cardsFromCardRows(
    rows.map((r) => ({
      title: toTitle(r),
      vouchers: r.vouchers,
      isNew: r.is_new,
      groupIds: r.group_ids,
      friends: r.friends,
      viaGroupId: r.via_group,
      ...(scope.kind === "home" ? { latestAt: r.latest_at } : {}),
    })),
  );
  return { cards, rowIds: new Map(rows.map((r) => [toTitle(r).id, r.id])) };
}

/** A list from the card query, with comment counts for `commentGroupIds` and streaming services. */
async function listFor(scope: CardScope, commentGroupIds: string[], region: string): Promise<List> {
  const [{ cards, rowIds }, comments] = await Promise.all([titleCards(scope), commentCounts(commentGroupIds)]);
  const counted = cards.map((card) => {
    const count = comments.get(rowIds.get(card.title.id) ?? "");
    return count ? { ...card, comments: count } : card;
  });
  return withServices(counted, rowIds, region);
}

/** A group's list: every title vouched for into it, one card per title (F5.1). */
export async function groupList(groupId: string, _viewerId: string, region: string): Promise<List> {
  return listFor({ kind: "group", groupId }, [groupId], region);
}

/** All groups: every group you're in, one card per title, each person once (F5.2). */
export async function allGroupsList(groupIds: string[], _viewerId: string, region: string): Promise<List> {
  if (groupIds.length === 0) return { cards: [], services: [] };
  return listFor({ kind: "groups" }, groupIds, region);
}

/** One import roll-up line on Home (PRD F16.3): only the good words you can see are counted. */
export type ImportRollup = { person: Person; importId: string; count: number; at: string; isNew: boolean };

export type HomeData = {
  list: List;
  rollups: ImportRollup[];
  /** Your own good words on Home's titles, by title id, for the vouch button. */
  mine: Record<string, MyGoodWord>;
};

const HOME_FIRST_VISIT_MS = 7 * 86_400_000;

/**
 * Home (PRD F16.3): every title with a good word from someone else you can
 * see, from the one card query, with each card's comments across the
 * conversations you can see (your groups', and under good words, F16.5), the
 * conversation it opens, streaming services, and the import roll-ups.
 */
export async function homeList(viewerId: string, region: string): Promise<HomeData> {
  const supabase = await createClient();
  const [{ cards, rowIds }, rollups, profile] = await Promise.all([
    titleCards({ kind: "home" }),
    supabase.rpc("home_import_rollups"),
    supabase.from("profiles").select("home_viewed_at").eq("user_id", viewerId).maybeSingle(),
  ]);
  const titleRowIds = [...rowIds.values()];
  const [{ data: talk }, { data: mineRows }, { data: wordRows }] =
    titleRowIds.length > 0
      ? await Promise.all([
          supabase.rpc("home_conversations", { p_titles: titleRowIds }),
          supabase
            .from("good_words")
            .select("title_id, note, source, created_at, friends_shared_at, good_word_groups(group_id, shared_at)")
            .eq("user_id", viewerId)
            .in("title_id", titleRowIds)
            .returns<Array<Omit<MineRow, "titles"> & { title_id: string }>>(),
          // Others' good words shared with friends that you can see: each has a conversation (F16.5).
          supabase
            .from("good_words")
            .select("id, user_id, title_id")
            .in("title_id", titleRowIds)
            .neq("user_id", viewerId)
            .not("friends_shared_at", "is", null)
            .returns<Array<{ id: string; user_id: string; title_id: string }>>(),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];
  const titleIdOf = new Map([...rowIds].map(([titleId, rowId]) => [rowId, titleId]));
  const mine = Object.fromEntries(
    (mineRows ?? []).flatMap((row) => {
      const titleId = titleIdOf.get(row.title_id);
      return titleId ? [[titleId, toMine(row)]] : [];
    }),
  );
  const seenAt = profile.data?.home_viewed_at as string | null | undefined;
  const seen = seenAt ? new Date(seenAt).getTime() : Date.now() - HOME_FIRST_VISIT_MS;
  const talkByRow = new Map(
    ((talk ?? []) as Array<{
      title_id: string;
      comment_count: number;
      unseen: boolean;
      latest_comment_id: string;
      latest_group_id: string | null;
      latest_good_word_id: string | null;
      latest_author_name: string;
      latest_body: string | null;
      latest_mentions: Array<{ id: string; name: string }> | null;
    }>).map((r) => [r.title_id, r]),
  );
  const wordsByRow = new Map<string, Map<string, string>>();
  for (const w of wordRows ?? []) {
    const byPerson = wordsByRow.get(w.title_id) ?? new Map<string, string>();
    byPerson.set(w.user_id, w.id);
    wordsByRow.set(w.title_id, byPerson);
  }
  const withComments = cards.map((card): ListCard => {
    const rowId = rowIds.get(card.title.id) ?? "";
    const row = talkByRow.get(rowId);
    const latest: LatestComment | undefined =
      row && (row.latest_good_word_id || row.latest_group_id)
        ? {
            authorName: row.latest_author_name,
            text: row.latest_body === null ? null : plainText(decodeBody(row.latest_body, row.latest_mentions ?? [])),
            commentId: row.latest_comment_id,
            conversation: row.latest_good_word_id
              ? { kind: "word", goodWordId: row.latest_good_word_id }
              : { kind: "group", groupId: row.latest_group_id! },
          }
        : undefined;
    // With no comments yet: the newest good word on the card that has a
    // conversation (shared with friends), else the group it came through.
    const words = wordsByRow.get(rowId);
    const newestWord = card.goodWords.map((g) => words?.get(g.person.id)).find(Boolean);
    const conversation: CardConversation | undefined =
      latest?.conversation ??
      (newestWord ? { kind: "word", goodWordId: newestWord } : card.viaGroupId ? { kind: "group", groupId: card.viaGroupId } : undefined);
    return {
      ...card,
      ...(row ? { comments: { count: row.comment_count, unseen: row.unseen } } : {}),
      ...(latest ? { latestComment: latest } : {}),
      ...(conversation ? { conversation } : {}),
    };
  });
  const list = await withServices(withComments, rowIds, region);
  return {
    list,
    rollups: ((rollups.data ?? []) as Array<{ user_id: string; name: string; import_id: string; added_count: number; at: string }>).map((r) => ({
      person: { id: r.user_id, name: r.name },
      importId: r.import_id,
      count: r.added_count,
      at: r.at,
      isNew: new Date(r.at).getTime() > seen,
    })),
    mine,
  };
}

/** Person view (F8): their good words you can see, with comments from the groups you share. */
export async function personList(userId: string, sharedGroupIds: string[], region: string): Promise<List> {
  return listFor({ kind: "person", userId }, sharedGroupIds, region);
}

type MineRow = {
  note: string | null;
  source: GoodWordSource;
  created_at: string;
  friends_shared_at: string | null;
  titles: TitleRow;
  good_word_groups: Array<{ group_id: string; shared_at: string }>;
};

function toMine(row: Omit<MineRow, "titles">): MyGoodWord {
  return {
    note: row.note ?? "",
    source: row.source,
    createdAt: row.created_at,
    groupIds: row.good_word_groups.map((g) => g.group_id),
    sharedAt: Object.fromEntries(row.good_word_groups.map((g) => [g.group_id, g.shared_at])),
    friendsSharedAt: row.friends_shared_at,
  };
}

/** My list: only your own good words, including ones in no group (F5.3). */
export async function myList(_userId: string, _name: string, region: string): Promise<List> {
  const { cards, rowIds } = await titleCards({ kind: "mine" });
  return withServices(cards, rowIds, region);
}

/** Whether you've put in a good word into this group yet (the first-good-word prompt, F5.7). */
export async function hasGoodWordIn(groupId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("good_word_groups")
    .select("id, good_words!inner(user_id)", { count: "exact", head: true })
    .eq("group_id", groupId)
    .eq("good_words.user_id", userId);
  return (count ?? 0) > 0;
}

/** The cached title's row id, saving it from TMDB first if nobody has viewed it yet. */
export async function titleRowId(type: TitleType, tmdbId: number): Promise<string | null> {
  const admin = createAdminClient();
  const find = async () =>
    (await admin.from("titles").select("id").eq("media_type", type).eq("tmdb_id", tmdbId).maybeSingle()).data?.id as
      | string
      | undefined;
  const found = await find();
  if (found) return found;
  if (!(await getTitle(type, tmdbId))) return null;
  return (await find()) ?? null;
}

type TitleGoodWordRow = {
  user_id: string;
  note: string | null;
  source: GoodWordSource;
  created_at: string;
  friends_shared_at: string | null;
  good_word_groups: Array<{ group_id: string; shared_at: string }>;
};

/**
 * Everyone in your groups who vouched for a title, yours first, and your own
 * good word for the vouch button (F6). Never anyone outside your groups, and
 * each good word's group chips name only your groups (PRD 8).
 */
export const titleGoodWords = cache(
  async (
    type: TitleType,
    tmdbId: number,
    viewer: Person,
    myGroups: Group[],
  ): Promise<{ goodWords: GoodWord[]; mine: MyGoodWord | null }> => {
    const supabase = await createClient();
    const { data: title } = await supabase.from("titles").select("id").eq("media_type", type).eq("tmdb_id", tmdbId).maybeSingle();
    if (!title) return { goodWords: [], mine: null };
    const { data, error } = await supabase
      .from("good_words")
      .select("user_id, note, source, created_at, friends_shared_at, good_word_groups(group_id, shared_at)")
      .eq("title_id", title.id)
      .returns<TitleGoodWordRow[]>();
    if (error) throw new Error(`title good words: ${error.code}`);
    const rows = data ?? [];
    const nameOf = await names(supabase, rows.map((r) => r.user_id));
    const groupOf = new Map(myGroups.map((g) => [g.id, { id: g.id, name: g.name }]));
    const groupsOf = (r: TitleGoodWordRow) => r.good_word_groups.flatMap((g) => groupOf.get(g.group_id) ?? []);
    const mineRow = rows.find((r) => r.user_id === viewer.id);
    const latestShare = (r: TitleGoodWordRow) =>
      r.good_word_groups.map((g) => g.shared_at).sort().at(-1) ?? r.created_at;
    const others = rows
      .filter((r) => r.user_id !== viewer.id && r.good_word_groups.length > 0)
      .map((r) => ({ person: { id: r.user_id, name: nameOf.get(r.user_id) ?? "" }, note: r.note, at: latestShare(r), groups: groupsOf(r) }))
      .sort((a, b) => b.at.localeCompare(a.at));
    const goodWords: GoodWord[] = [
      ...(mineRow ? [{ person: viewer, note: mineRow.note, at: mineRow.created_at, groups: groupsOf(mineRow) }] : []),
      ...others,
    ].map((g) => ({ person: g.person, ...(g.note ? { note: g.note } : {}), at: new Date(g.at), groups: g.groups }));
    return { goodWords, mine: mineRow ? toMine(mineRow) : null };
  },
);

/** A good word on the title page (PRD F16.4): which one, and its conversation when it's shared with friends. */
export type TitleGoodWord = GoodWord & { goodWordId: string; conversation?: WordConversationPreview };

/**
 * The title page with friends (PRD F16.4, F16.6): every good word for a title
 * that the viewer may see, yours first, then newest first, each at the time
 * it reached them; the chips of your groups each is in; and, for each one
 * shared with friends, its conversation (F16.5). Row-level security decides
 * which good words come back; nothing else is counted or hinted at.
 */
export async function titleGoodWordsWithFriends(
  type: TitleType,
  tmdbId: number,
  viewer: Person,
  myGroups: Group[],
  friendIds: string[],
): Promise<{ goodWords: TitleGoodWord[]; mine: MyGoodWord | null }> {
  const supabase = await createClient();
  const { data: title } = await supabase.from("titles").select("id").eq("media_type", type).eq("tmdb_id", tmdbId).maybeSingle();
  if (!title) return { goodWords: [], mine: null };
  const [{ data, error }, talk] = await Promise.all([
    supabase
      .from("good_words")
      .select("id, user_id, note, source, created_at, friends_shared_at, good_word_groups(group_id, shared_at)")
      .eq("title_id", title.id)
      .returns<Array<TitleGoodWordRow & { id: string }>>(),
    supabase.rpc("title_word_conversations", { p_title: title.id }),
  ]);
  if (error) throw new Error(`title good words: ${error.code}`);
  const rows = data ?? [];
  const nameOf = await names(supabase, rows.map((r) => r.user_id));
  const groupOf = new Map(myGroups.map((g) => [g.id, { id: g.id, name: g.name }]));
  const friends = new Set(friendIds);
  const conversations = new Map(
    ((talk.data ?? []) as Array<{ good_word_id: string; comment_count: number; unseen: boolean; recent: CommentRow[] }>).map((c) => [
      c.good_word_id,
      { count: c.comment_count, unseen: c.unseen, recent: c.recent.map((r) => toComment(r, viewer.id)) },
    ]),
  );
  // When it reached you: its newest share into one of your groups, or with friends if you're a friend.
  const reached = (r: TitleGoodWordRow) =>
    [...r.good_word_groups.filter((g) => groupOf.has(g.group_id)).map((g) => g.shared_at), ...(r.friends_shared_at && friends.has(r.user_id) ? [r.friends_shared_at] : [])]
      .sort()
      .at(-1) ?? r.created_at;
  const toGoodWord = (r: TitleGoodWordRow & { id: string }, person: Person, at: string): TitleGoodWord => {
    const conversation = conversations.get(r.id);
    return {
      goodWordId: r.id,
      person,
      ...(r.note ? { note: r.note } : {}),
      at: new Date(at),
      groups: r.good_word_groups.flatMap((g) => groupOf.get(g.group_id) ?? []),
      ...(person.id === viewer.id && r.friends_shared_at ? { friends: true } : {}),
      ...(conversation ? { conversation } : {}),
    };
  };
  const mineRow = rows.find((r) => r.user_id === viewer.id);
  const others = rows
    .filter((r) => r.user_id !== viewer.id)
    .map((r) => toGoodWord(r, { id: r.user_id, name: nameOf.get(r.user_id) ?? "" }, reached(r)))
    .sort((a, b) => b.at.getTime() - a.at.getTime());
  return {
    goodWords: [...(mineRow ? [toGoodWord(mineRow, viewer, mineRow.created_at)] : []), ...others],
    mine: mineRow ? toMine(mineRow) : null,
  };
}

export type SearchAnnotations = {
  /** Your own good words, by title key ("tv-101"). */
  mine: Record<string, MyGoodWord>;
  /** People in your groups who vouched, by title key. */
  friends: Record<string, Person[]>;
};

/** "On your list" and "Priya vouched for this" for search results (F3). */
export async function searchAnnotations(titles: Array<Pick<Title, "type" | "tmdbId">>, viewerId: string): Promise<SearchAnnotations> {
  const result: SearchAnnotations = { mine: {}, friends: {} };
  const tmdbIds = [...new Set(titles.map((t) => t.tmdbId).filter((id): id is number => typeof id === "number"))];
  if (tmdbIds.length === 0) return result;
  const supabase = await createClient();
  const { data: cached } = await supabase.from("titles").select("id, tmdb_id, media_type").in("tmdb_id", tmdbIds);
  const wanted = new Set(titles.map((t) => titleKey(t.type, t.tmdbId ?? 0)));
  const keyOf = new Map(
    (cached ?? [])
      .map((t) => [t.id as string, titleKey(t.media_type as TitleType, t.tmdb_id as number)] as const)
      .filter(([, key]) => wanted.has(key)),
  );
  if (keyOf.size === 0) return result;
  const { data } = await supabase
    .from("good_words")
    .select("title_id, user_id, note, source, created_at, friends_shared_at, good_word_groups(group_id, shared_at)")
    .in("title_id", [...keyOf.keys()])
    .order("created_at", { ascending: false })
    .returns<Array<TitleGoodWordRow & { title_id: string }>>();
  const rows = data ?? [];
  const nameOf = await names(supabase, rows.filter((r) => r.user_id !== viewerId).map((r) => r.user_id));
  for (const row of rows) {
    const key = keyOf.get(row.title_id)!;
    if (row.user_id === viewerId) result.mine[key] = toMine(row);
    else if (row.good_word_groups.length > 0) {
      (result.friends[key] ??= []).push({ id: row.user_id, name: nameOf.get(row.user_id) ?? "" });
    }
  }
  return result;
}
