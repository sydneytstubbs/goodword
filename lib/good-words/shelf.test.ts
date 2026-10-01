import { describe, expect, it } from "vitest";
import type { MyGoodWord, Title } from "@/components/domain/types";
import { audienceNames } from "@/lib/format";
import { applyOverlays, cardsFromRows, type VouchRow } from "./shelf";

const ferry: Title = { id: "tv-101", type: "tv", tmdbId: 101, name: "The Night Ferry", year: 2024, genres: ["Drama"], accent: "plum" };
const moth: Title = { id: "movie-202", type: "movie", tmdbId: 202, name: "Moth Season", genres: ["Horror"], accent: "clay" };
const heist: Title = { id: "movie-303", type: "movie", tmdbId: 303, name: "Grandma's Heist", genres: ["Comedy"], accent: "ochre" };

const priya = { id: "priya", name: "Priya" };
const row = (title: Title, userId: string, name: string, at: string, note: string | null = null): VouchRow => ({
  title,
  userId,
  name,
  note,
  at,
});

describe("cardsFromRows", () => {
  it("makes one card per title with a growing vouched-by row, newest first", () => {
    const cards = cardsFromRows([
      row(ferry, "jonah", "Jonah", "2026-09-20T10:00:00Z", "the ferry scene"),
      row(moth, "tess", "Tess", "2026-09-25T10:00:00Z"),
      row(ferry, "priya", "Priya", "2026-09-28T10:00:00Z", "ep 3 is where it gets you"),
    ]);
    expect(cards.map((c) => c.title.name)).toEqual(["The Night Ferry", "Moth Season"]);
    expect(cards[0].goodWords.map((g) => g.person.name)).toEqual(["Priya", "Jonah"]);
    expect(cards[0].goodWords[0].note).toBe("ep 3 is where it gets you");
  });

  it("lists each person once across groups, at their most recent share (All groups)", () => {
    const cards = cardsFromRows([
      row(ferry, "priya", "Priya", "2026-09-20T10:00:00Z", "ep 3"),
      row(ferry, "priya", "Priya", "2026-09-27T10:00:00Z", "ep 3"),
      row(ferry, "jonah", "Jonah", "2026-09-22T10:00:00Z"),
    ]);
    expect(cards).toHaveLength(1);
    expect(cards[0].goodWords.map((g) => [g.person.name, g.at.toISOString()])).toEqual([
      ["Priya", "2026-09-27T10:00:00.000Z"],
      ["Jonah", "2026-09-22T10:00:00.000Z"],
    ]);
  });

  it("leaves out empty notes", () => {
    const [card] = cardsFromRows([row(moth, "tess", "Tess", "2026-09-25T10:00:00Z", null)]);
    expect(card.goodWords[0]).not.toHaveProperty("note");
  });
});

const mine = (groupIds: string[], note = "", createdAt = "2026-09-29T09:00:00Z"): MyGoodWord => ({
  note,
  groupIds,
  createdAt,
  source: "organic",
  sharedAt: Object.fromEntries(groupIds.map((id) => [id, createdAt])),
});

describe("applyOverlays", () => {
  const shelf = cardsFromRows([
    row(ferry, "jonah", "Jonah", "2026-09-20T10:00:00Z", "the ferry scene"),
    row(heist, "tess", "Tess", "2026-09-26T10:00:00Z"),
  ]);

  it("puts a new card at the top of each shelf it's shared into", () => {
    const cards = applyOverlays(shelf, [{ title: moth, mine: mine(["crew"], "so creepy") }], { kind: "group", groupId: "crew" }, priya);
    expect(cards.map((c) => c.title.name)).toEqual(["Moth Season", "Grandma's Heist", "The Night Ferry"]);
    expect(cards[0].goodWords).toEqual([{ person: priya, note: "so creepy", at: new Date("2026-09-29T09:00:00Z") }]);
  });

  it("leaves shelves it isn't shared into alone", () => {
    const cards = applyOverlays(shelf, [{ title: moth, mine: mine(["girls"]) }], { kind: "group", groupId: "crew" }, priya);
    expect(cards).toEqual(shelf);
  });

  it("joins a friend's card instead of adding a second one, listing you first", () => {
    const cards = applyOverlays(shelf, [{ title: ferry, mine: mine(["crew"]) }], { kind: "group", groupId: "crew" }, priya);
    expect(cards).toHaveLength(2);
    expect(cards[0].title.name).toBe("The Night Ferry");
    expect(cards[0].goodWords.map((g) => g.person.name)).toEqual(["Priya", "Jonah"]);
  });

  it("takes a card off when your good word was the only one on it", () => {
    const withMine = cardsFromRows([row(moth, "priya", "Priya", "2026-09-29T09:00:00Z")]);
    expect(applyOverlays(withMine, [{ title: moth, mine: null }], { kind: "mine" }, priya)).toEqual([]);
  });

  it("keeps a friend's card when you take yours back", () => {
    const both = applyOverlays(shelf, [{ title: ferry, mine: mine(["crew"]) }], { kind: "group", groupId: "crew" }, priya);
    const cards = applyOverlays(both, [{ title: ferry, mine: null }], { kind: "group", groupId: "crew" }, priya);
    expect(cards.find((c) => c.title.id === ferry.id)!.goodWords.map((g) => g.person.name)).toEqual(["Jonah"]);
  });

  it("shows zero-group good words on My Recs with no groups", () => {
    const cards = applyOverlays([], [{ title: moth, mine: mine([]) }], { kind: "mine" }, priya);
    expect(cards).toHaveLength(1);
    expect(cards[0].groupIds).toEqual([]);
  });

  it("shows a good word on All groups if it's on any of your groups", () => {
    const scope = { kind: "all" as const, groupIds: ["crew", "girls"] };
    expect(applyOverlays([], [{ title: moth, mine: mine(["girls"]) }], scope, priya)).toHaveLength(1);
    expect(applyOverlays([], [{ title: moth, mine: mine([]) }], scope, priya)).toHaveLength(0);
  });

  it("updates an edited note in place without moving the card", () => {
    const withMine = cardsFromRows([
      row(ferry, "priya", "Priya", "2026-09-20T10:00:00Z", "old"),
      row(heist, "tess", "Tess", "2026-09-26T10:00:00Z"),
    ]);
    const edited = { ...mine(["crew"], "new", "2026-09-20T10:00:00Z") };
    const cards = applyOverlays(withMine, [{ title: ferry, mine: edited }], { kind: "group", groupId: "crew" }, priya);
    expect(cards.map((c) => c.title.name)).toEqual(["Grandma's Heist", "The Night Ferry"]);
    expect(cards[1].goodWords[0].note).toBe("new");
  });
});

describe("audienceNames", () => {
  it("names up to two people, then a count", () => {
    expect(audienceNames(["Jonah"])).toBe("Jonah");
    expect(audienceNames(["Jonah", "Tess"])).toBe("Jonah and Tess");
    expect(audienceNames(["Jonah", "Tess", "Mo"])).toBe("Jonah, Tess, and 1 other");
    expect(audienceNames(["Jonah", "Tess", "Mo", "Luis", "Bea"])).toBe("Jonah, Tess, and 3 others");
  });
});
