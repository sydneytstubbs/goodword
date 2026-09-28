// Invented content for the marketing mockups (spec 7.7). Never real titles,
// posters, or people.
import { resolveGenreAccent } from "@/lib/genre-accent";
import type { GoodWord, Person, Title } from "../domain/types";

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

/** The person whose phone the mockups show. */
export const viewer = people.luis;

const title = (t: Omit<Title, "accent">): Title => ({ ...t, accent: resolveGenreAccent(t.genres, t.id) });

export const titles = {
  nightFerry: title({ id: "m-1", type: "tv", name: "The Night Ferry", year: 2024, genres: ["Drama", "Mystery"] }),
  lowTide: title({ id: "m-2", type: "tv", name: "Low Tide Club", year: 2023, genres: ["Comedy"] }),
  heist: title({ id: "m-3", type: "movie", name: "Grandma's Heist", year: 2022, runtime: 104, genres: ["Crime", "Comedy"] }),
  parking: title({ id: "m-4", type: "movie", name: "Parallel Parking", year: 2024, runtime: 96, genres: ["Comedy", "Romance"] }),
  moth: title({ id: "m-5", type: "movie", name: "Moth Season", year: 2025, runtime: 112, genres: ["Horror"] }),
  salt: title({ id: "m-6", type: "movie", name: "Salt & Static", year: 2023, runtime: 101, genres: ["Comedy", "Science Fiction"] }),
};

export const groups = {
  college: { id: "college-crew", name: "College crew" },
  girls: { id: "the-girls", name: "The girls" },
  book: { id: "sunday-book-club", name: "Sunday book club" },
};

export const members = {
  college: [people.priya, people.jonah, people.tess, people.mo, people.luis, people.bea],
  girls: [people.tess, people.bea, people.priya],
  book: [people.jonah, people.luis, people.mo, people.tess],
};

const gw = (person: Person, minutes: number, note?: string): GoodWord => ({ person, note, at: ago(minutes) });

export const goodWords = {
  nightFerry: [gw(people.priya, 120, "ep 3 is where it gets you"), gw(people.jonah, 1500), gw(people.mo, 4000)],
  moth: [gw(people.tess, 300, "watch it with the lights on")],
  lowTide: [gw(people.bea, 30), gw(people.priya, 900)],
  heist: [gw(people.priya, 700), gw(people.mo, 2000)],
  parking: [gw(people.bea, 60)],
  salt: [gw(people.jonah, 400)],
};
