// Shelf cards from good word rows, and the viewer's pending changes laid over
// them (PRD F4, F5; section 8 "Derived views"). Pure, so it runs on the server
// for the first render and in the browser for optimistic updates.
import type { GoodWord, MyGoodWord, Person, ShelfCard, Title } from "@/components/domain/types";

/** One person's good word on one shelf: `at` is when it went on that shelf. */
export type VouchRow = {
  title: Title;
  userId: string;
  name: string;
  note: string | null;
  at: string;
  /** My shelf only: the groups it's shared into. */
  groupIds?: string[];
};

const time = (iso: string) => new Date(iso).getTime();
const latest = (card: ShelfCard) => Math.max(0, ...card.goodWords.map((g) => g.at.getTime()));

function sortCards(cards: ShelfCard[]): ShelfCard[] {
  return cards
    .map((card) => ({ ...card, goodWords: [...card.goodWords].sort((a, b) => b.at.getTime() - a.at.getTime()) }))
    .sort((a, b) => latest(b) - latest(a) || a.title.name.localeCompare(b.title.name));
}

/**
 * One card per title, newest good word first. The same person on several
 * shelves (All groups) appears once, at their most recent share (F5.2).
 */
export function cardsFromRows(rows: VouchRow[]): ShelfCard[] {
  const byTitle = new Map<string, { title: Title; people: Map<string, VouchRow>; groupIds?: string[] }>();
  for (const row of rows) {
    const entry = byTitle.get(row.title.id) ?? { title: row.title, people: new Map(), groupIds: row.groupIds };
    const seen = entry.people.get(row.userId);
    if (!seen || time(row.at) > time(seen.at)) entry.people.set(row.userId, row);
    byTitle.set(row.title.id, entry);
  }
  return sortCards(
    [...byTitle.values()].map(({ title, people, groupIds }) => ({
      title,
      goodWords: [...people.values()].map((r) => goodWord({ id: r.userId, name: r.name }, r.note, r.at)),
      ...(groupIds ? { groupIds } : {}),
    })),
  );
}

function goodWord(person: Person, note: string | null, at: string): GoodWord {
  return { person, ...(note ? { note } : {}), at: new Date(at) };
}

/** A change to the viewer's own good word on a title that the server hasn't confirmed yet. */
export type Overlay = { title: Title; mine: MyGoodWord | null };

export type ShelfScope = { kind: "group"; groupId: string } | { kind: "all"; groupIds: string[] } | { kind: "mine" };

/** When the viewer's good word went on this shelf, or null if it isn't on it. */
function shelvedAt(mine: MyGoodWord, scope: ShelfScope): string | null {
  if (scope.kind === "mine") return mine.createdAt;
  const ids = scope.kind === "group" ? [scope.groupId] : scope.groupIds;
  const dates = mine.groupIds.filter((id) => ids.includes(id)).map((id) => mine.sharedAt[id] ?? mine.createdAt);
  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (time(b) > time(a) ? b : a));
}

/**
 * The shelf as the viewer should see it right now: their pending good words
 * put in, edited, moved, or taken back. A card nobody vouches for anymore
 * leaves the shelf; a new one goes to the top.
 */
export function applyOverlays(cards: ShelfCard[], overlays: Overlay[], scope: ShelfScope, viewer: Person): ShelfCard[] {
  if (overlays.length === 0) return cards;
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
      ...(scope.kind === "mine" && mine ? { groupIds: mine.groupIds } : {}),
    });
  }
  return sortCards([...byTitle.values()]);
}
