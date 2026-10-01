import "server-only";
import { cache } from "react";
import type { GoodWord, GoodWordSource, Group, MyGoodWord, Person, Service, Shelf, ShelfCard, Title, TitleType } from "@/components/domain/types";
import { commentCounts } from "@/lib/conversations/queries";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getTitle } from "@/lib/titles/cache";
import { safeRegion, shelfProviders } from "@/lib/titles/providers";
import { recordToTitle, titleKey, type TitleRecord } from "@/lib/tmdb/normalize";
import { cardsFromRows } from "./shelf";

// Good word reads (PRD F4, F5, F6). Everything here runs as the signed-in
// user, under row-level security: someone else's good word shows only if it's
// on a shelf the viewer is on, with only the viewer's groups (PRD 8).

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

type ShelfRow = {
  shared_at: string;
  group_id: string;
  good_words: { user_id: string; note: string | null; titles: TitleRow };
};

/** When the viewer last looked at each group's shelf, or joined it if never (F5.5). */
async function lastViewed(supabase: Supabase, userId: string, groupIds: string[]): Promise<Map<string, number>> {
  const { data } = await supabase
    .from("group_members")
    .select("group_id, last_viewed_at, joined_at")
    .eq("user_id", userId)
    .in("group_id", groupIds);
  return new Map(
    (data ?? []).map((m) => [m.group_id as string, new Date((m.last_viewed_at ?? m.joined_at) as string).getTime()]),
  );
}

/** Cards with their streaming services in the viewer's region, and every service on the shelf. */
async function withServices(cards: ShelfCard[], rowIds: Map<string, string>, region: string): Promise<Shelf> {
  const refs = cards.flatMap((c) => {
    const rowId = rowIds.get(c.title.id);
    return rowId && c.title.tmdbId ? [{ rowId, type: c.title.type, tmdbId: c.title.tmdbId }] : [];
  });
  const providers = await shelfProviders(refs, safeRegion(region));
  const services = new Map<number, Service>();
  const withIds = cards.map((card) => {
    const found = providers.get(rowIds.get(card.title.id) ?? "");
    if (!found) return card;
    for (const p of found.stream) services.set(p.id, { id: p.id, name: p.name });
    return { ...card, services: found.stream.map((p) => p.id) };
  });
  return { cards: withIds, services: [...services.values()] };
}

async function groupsShelf(groupIds: string[], viewerId: string, region: string): Promise<Shelf> {
  if (groupIds.length === 0) return { cards: [], services: [] };
  const supabase = await createClient();
  const [{ data, error }, since, comments] = await Promise.all([
    supabase
      .from("good_word_groups")
      .select(`shared_at, group_id, good_words!inner(user_id, note, titles!inner(${TITLE_COLUMNS}))`)
      .in("group_id", groupIds)
      .order("shared_at", { ascending: false })
      .returns<ShelfRow[]>(),
    lastViewed(supabase, viewerId, groupIds),
    commentCounts(groupIds),
  ]);
  if (error) throw new Error(`shelf: ${error.code}`);
  const rows = data ?? [];
  const nameOf = await names(supabase, rows.map((r) => r.good_words.user_id));
  const rowIds = new Map(rows.map((r) => [toTitle(r.good_words.titles).id, r.good_words.titles.id]));
  // New: someone else's good word went on this shelf since you last looked (F5.5).
  const fresh = new Set(
    rows
      .filter((r) => r.good_words.user_id !== viewerId && new Date(r.shared_at).getTime() > (since.get(r.group_id) ?? Infinity))
      .map((r) => toTitle(r.good_words.titles).id),
  );
  const cards = cardsFromRows(
    rows.map((r) => ({
      title: toTitle(r.good_words.titles),
      userId: r.good_words.user_id,
      name: nameOf.get(r.good_words.user_id) ?? "",
      note: r.good_words.note,
      at: r.shared_at,
    })),
  ).map((card) => {
    const counted = comments.get(rowIds.get(card.title.id) ?? "");
    return { ...card, ...(fresh.has(card.title.id) ? { isNew: true } : {}), ...(counted ? { comments: counted } : {}) };
  });
  return withServices(cards, rowIds, region);
}

/** A group's shelf: every title vouched for into it, one card per title (F5.1). */
export async function groupShelf(groupId: string, viewerId: string, region: string): Promise<Shelf> {
  return groupsShelf([groupId], viewerId, region);
}

/** All groups: every group you're in, one card per title, each person once (F5.2). */
export async function allGroupsShelf(groupIds: string[], viewerId: string, region: string): Promise<Shelf> {
  return groupsShelf(groupIds, viewerId, region);
}

type MineRow = {
  note: string | null;
  source: GoodWordSource;
  created_at: string;
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
  };
}

/** My Recs: only your own good words, including ones in no group (F5.3). */
export async function myShelf(userId: string, name: string, region: string): Promise<Shelf> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("good_words")
    .select(`note, source, created_at, titles!inner(${TITLE_COLUMNS}), good_word_groups(group_id, shared_at)`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<MineRow[]>();
  if (error) throw new Error(`my shelf: ${error.code}`);
  const rows = data ?? [];
  const cards = cardsFromRows(
    rows.map((r) => ({
      title: toTitle(r.titles),
      userId,
      name,
      note: r.note,
      at: r.created_at,
      groupIds: r.good_word_groups.map((g) => g.group_id),
    })),
  );
  return withServices(cards, new Map(rows.map((r) => [toTitle(r.titles).id, r.titles.id])), region);
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
      .select("user_id, note, source, created_at, good_word_groups(group_id, shared_at)")
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

export type SearchAnnotations = {
  /** Your own good words, by title key ("tv-101"). */
  mine: Record<string, MyGoodWord>;
  /** People in your groups who vouched, by title key. */
  friends: Record<string, Person[]>;
};

/** "On your shelf" and "Priya vouched for this" for search results (F3). */
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
    .select("title_id, user_id, note, source, created_at, good_word_groups(group_id, shared_at)")
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
