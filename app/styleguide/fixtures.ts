// Invented content only (CLAUDE.md): titles The Night Ferry, Low Tide Club,
// Grandma's Heist, Moth Season; people Priya, Jonah, Tess, Mo, Luis, Bea;
// groups College crew, The girls, Sunday book club.
import type { CommentData, GoodWord, Person, Title } from "@/components/domain/types";
import type { GroupWithCount } from "@/components/domain/visibility-line";
import type { SwitcherGroup } from "@/components/domain/group-switcher";
import { resolveGenreAccent } from "@/lib/genre-accent";
import type { WatchProviders } from "@/lib/tmdb/normalize";

/** A fixed "now", so relative times and screenshots never drift. */
export const NOW = new Date("2026-09-28T18:00:00Z");
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

export const people = {
  priya: { id: "priya", name: "Priya" },
  jonah: { id: "jonah", name: "Jonah" },
  tess: { id: "tess", name: "Tess" },
  mo: { id: "mo", name: "Mo" },
  luis: { id: "luis", name: "Luis" },
  bea: { id: "bea", name: "Bea" },
} satisfies Record<string, Person>;

/** The person looking at the styleguide. */
export const viewer = people.tess;

const title = (t: Omit<Title, "accent">): Title => ({ ...t, accent: resolveGenreAccent(t.genres, t.id) });

export const titles = {
  nightFerry: title({ id: "tv-1", type: "tv", name: "The Night Ferry", year: 2024, genres: ["Drama", "Mystery"] }),
  lowTide: title({ id: "tv-2", type: "tv", name: "Low Tide Club", year: 2023, genres: ["Comedy"] }),
  heist: title({ id: "movie-1", type: "movie", name: "Grandma's Heist", year: 2022, runtime: 104, genres: ["Crime", "Comedy"] }),
  moth: title({ id: "movie-2", type: "movie", name: "Moth Season", year: 2025, runtime: 112, genres: ["Horror"] }),
};
export const allTitles = Object.values(titles);

export const groups = {
  college: { id: "college-crew", name: "College crew" },
  girls: { id: "the-girls", name: "The girls" },
  book: { id: "sunday-book-club", name: "Sunday book club" },
};

export const members = {
  college: [people.priya, people.jonah, people.tess, people.mo, people.luis, people.bea],
  girls: [people.tess, people.bea, people.priya],
  book: [people.jonah, people.luis, people.tess, people.mo],
};

export const groupsWithCounts: GroupWithCount[] = [
  { ...groups.college, memberCount: members.college.length },
  { ...groups.girls, memberCount: members.girls.length },
  { ...groups.book, memberCount: members.book.length },
];

export const switcherGroups: SwitcherGroup[] = [
  { ...groups.college, members: members.college },
  { ...groups.girls, members: members.girls },
  { ...groups.book, members: members.book },
];

export const goodWords: Record<string, GoodWord[]> = {
  nightFerry: [
    { person: people.priya, note: "ep 3 is where it gets you", at: ago(120) },
    { person: people.jonah, note: "strange and perfect", at: ago(60 * 26) },
    { person: people.mo, at: ago(60 * 24 * 3) },
  ],
  lowTide: [
    { person: people.tess, note: "comfort rewatch, every time", at: ago(15) },
    { person: people.bea, at: ago(60 * 5) },
  ],
  heist: [{ person: people.luis, note: "the grandma steals every scene", at: ago(60 * 24 * 10) }],
  moth: [],
};

/** Where to watch, with invented logos left out (the letter fallback shows). */
export const providers: WatchProviders = {
  stream: [
    { id: 8, name: "Netflix", logo: null },
    { id: 15, name: "Hulu", logo: null },
  ],
  rent: [{ id: 2, name: "Apple TV Store", logo: null }],
  buy: [
    { id: 2, name: "Apple TV Store", logo: null },
    { id: 10, name: "Amazon Video", logo: null },
  ],
  link: "https://www.themoviedb.org/",
};

export const comments: CommentData[] = [
  {
    id: "c1",
    author: people.jonah,
    at: ago(180),
    body: [{ kind: "text", text: "the lighthouse scene. I had to pause it." }],
  },
  {
    id: "c2",
    author: people.priya,
    at: ago(120),
    edited: true,
    body: [
      { kind: "mention", userId: "tess", name: "Tess" },
      { kind: "text", text: " you have to get to ep 6 before we talk" },
    ],
  },
  {
    id: "c3",
    author: people.tess,
    at: ago(95),
    body: [
      { kind: "text", text: "just finished ep 6. " },
      { kind: "mention", userId: "priya", name: "Priya" },
      { kind: "text", text: " you were right" },
    ],
  },
  {
    id: "c4",
    author: people.mo,
    at: ago(40),
    spoiler: true,
    body: [{ kind: "text", text: "the captain was the one writing the letters the whole time" }],
  },
  {
    id: "c5",
    author: people.tess,
    at: ago(10),
    spoiler: true,
    body: [{ kind: "text", text: "the final shot of the empty deck though" }],
  },
];

/** A fake search: filters the four titles, with a small delay so loading shows. */
export async function fakeSearch(query: string): Promise<Title[]> {
  await new Promise((resolve) => setTimeout(resolve, 600));
  if (query.toLowerCase().includes("error")) throw new Error("Search failed");
  const q = query.toLowerCase().replace("nite", "night");
  return allTitles.filter((t) => t.name.toLowerCase().includes(q));
}
