// List cards from good word rows, and the viewer's pending changes laid over
// them (PRD F4, F5; section 8 "Derived views"). Pure, so it runs on the server
// for the first render and in the browser for optimistic updates.
import type { GoodWord, MyGoodWord, Person, ListCard, Title } from "@/components/domain/types";

/** One person's good word on one list: `at` is when it went on that list. */
export type VouchRow = {
  title: Title;
  userId: string;
  name: string;
  note: string | null;
  at: string;
  /** My list only: the groups it's shared into. */
  groupIds?: string[];
  /** My list only: shared with your friends too (PRD F16.2). */
  friends?: boolean;
};

const time = (iso: string) => new Date(iso).getTime();
// Home's cards keep their own time: imports and your good word never move them (PRD F16.3).
const latest = (card: ListCard) => card.latestAt?.getTime() ?? Math.max(0, ...card.goodWords.map((g) => g.at.getTime()));

function sortCards(cards: ListCard[]): ListCard[] {
  return cards
    .map((card) => ({ ...card, goodWords: [...card.goodWords].sort((a, b) => b.at.getTime() - a.at.getTime()) }))
    .sort((a, b) => latest(b) - latest(a) || a.title.name.localeCompare(b.title.name));
}

/**
 * One card per title, newest good word first. The same person on several
 * lists (All groups) appears once, at their most recent share (F5.2).
 */
export function cardsFromRows(rows: VouchRow[]): ListCard[] {
  const byTitle = new Map<string, { title: Title; people: Map<string, VouchRow>; groupIds?: string[]; friends?: boolean }>();
  for (const row of rows) {
    const entry = byTitle.get(row.title.id) ?? { title: row.title, people: new Map(), groupIds: row.groupIds, friends: row.friends };
    const seen = entry.people.get(row.userId);
    if (!seen || time(row.at) > time(seen.at)) entry.people.set(row.userId, row);
    byTitle.set(row.title.id, entry);
  }
  return sortCards(
    [...byTitle.values()].map(({ title, people, groupIds, friends }) => ({
      title,
      goodWords: [...people.values()].map((r) => goodWord({ id: r.userId, name: r.name }, r.note, r.at)),
      ...(groupIds ? { groupIds } : {}),
      ...(friends ? { friends } : {}),
    })),
  );
}

/** One row from title_cards (PRD F16.11): a title, who vouched, and what's new. */
export type CardRow = {
  title: Title;
  vouchers: Array<{ user_id: string; name: string; note: string | null; at: string }>;
  isNew: boolean;
  /** Scope mine only. */
  groupIds: string[] | null;
  friends: boolean | null;
  /** Scope home only. */
  viaGroupId?: string | null;
  /** Scope home only: when someone else's good word (not an import) last moved the card. */
  latestAt?: string | null;
};

/** Cards from title_cards rows, in the same order and shape as cardsFromRows. */
export function cardsFromCardRows(rows: CardRow[]): ListCard[] {
  return sortCards(
    rows.map((row) => ({
      title: row.title,
      goodWords: row.vouchers.map((v) => goodWord({ id: v.user_id, name: v.name }, v.note, v.at)),
      ...(row.isNew ? { isNew: true } : {}),
      ...(row.groupIds ? { groupIds: row.groupIds } : {}),
      ...(row.friends ? { friends: true } : {}),
      ...(row.viaGroupId ? { viaGroupId: row.viaGroupId } : {}),
      ...(row.latestAt ? { latestAt: new Date(row.latestAt) } : {}),
    })),
  );
}

function goodWord(person: Person, note: string | null, at: string): GoodWord {
  return { person, ...(note ? { note } : {}), at: new Date(at) };
}

/** A change to the viewer's own good word on a title that the server hasn't confirmed yet. */
export type Overlay = { title: Title; mine: MyGoodWord | null };

export type ListScope =
  | { kind: "group"; groupId: string }
  | { kind: "all"; groupIds: string[] }
  | { kind: "mine" }
  | { kind: "home" };

/** When the viewer's good word went on this list, or null if it isn't on it. */
function shelvedAt(mine: MyGoodWord, scope: ListScope): string | null {
  if (scope.kind === "mine" || scope.kind === "home") return mine.createdAt;
  const ids = scope.kind === "group" ? [scope.groupId] : scope.groupIds;
  const dates = mine.groupIds.filter((id) => ids.includes(id)).map((id) => mine.sharedAt[id] ?? mine.createdAt);
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (time(b) > time(a) ? b : a));
}

/**
 * The list as the viewer should see it right now: their pending good words
 * put in, edited, moved, or taken back. A card nobody vouches for anymore
 * leaves the list; a new one goes to the top.
 */
export function applyOverlays(cards: ListCard[], overlays: Overlay[], scope: ListScope, viewer: Person): ListCard[] {
  if (overlays.length === 0) return cards;
  // Home (PRD F16.3): your good word only names you on a card someone else
  // made. It never adds a card, takes one away, or moves one.
  if (scope.kind === "home") {
    return cards.map((card) => {
      const overlay = overlays.find((o) => o.title.id === card.title.id);
      if (!overlay) return card;
      const others = card.goodWords.filter((g) => g.person.id !== viewer.id);
      const at = overlay.mine ? shelvedAt(overlay.mine, scope) : null;
      const goodWords = at && overlay.mine ? [...others, goodWord(viewer, overlay.mine.note || null, at)] : others;
      return { ...card, goodWords: [...goodWords].sort((a, b) => b.at.getTime() - a.at.getTime()) };
    });
  }
  const byTitle = new Map(cards.map((card) => [card.title.id, card]));
  for (const { title, mine } of overlays) {
    const card = byTitle.get(title.id);
    const others = (card?.goodWords ?? []).filter((g) => g.person.id !== viewer.id);
    const at = mine ? shelvedAt(mine, scope) : null;
    const goodWords = at && mine ? [goodWord(viewer, mine.note || null, at), ...others] : others;
    if (goodWords.length === 0) {
      byTitle.delete(title.id);
      continue;
    }
    byTitle.set(title.id, {
      ...card,
      title: card?.title ?? title,
      goodWords,
      ...(scope.kind === "mine" && mine ? { groupIds: mine.groupIds, friends: Boolean(mine.friendsSharedAt) } : {}),
    });
  }
  return sortCards([...byTitle.values()]);
}
