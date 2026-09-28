// Fallback poster tone from the title's first TMDB genre (DESIGN-SYSTEM.md 4.2.1).
// Resolved once when a title is first saved and stored on the title record.
import { peopleTone, type PeopleTone } from "./people-color";

export type GenreAccent = "clay" | "ochre" | "moss" | "plum";

export const genreAccent: Record<string, GenreAccent> = {
  // clay: heat and intensity
  Action: "clay",
  Adventure: "clay",
  "Action & Adventure": "clay",
  Thriller: "clay",
  Horror: "clay",
  War: "clay",
  "War & Politics": "clay",
  Western: "clay",
  // ochre: light and warm
  Comedy: "ochre",
  Family: "ochre",
  Kids: "ochre",
  Animation: "ochre",
  Music: "ochre",
  Reality: "ochre",
  Talk: "ochre",
  // moss: grounded and real
  Documentary: "moss",
  History: "moss",
  Crime: "moss",
  News: "moss",
  // plum: dreamy and emotional
  Drama: "plum",
  Romance: "plum",
  Fantasy: "plum",
  "Science Fiction": "plum",
  "Sci-Fi & Fantasy": "plum",
  Mystery: "plum",
  Soap: "plum",
  "TV Movie": "plum",
};

const accentTone: Record<GenreAccent, PeopleTone> = { clay: 1, ochre: 2, moss: 3, plum: 4 };
const toneAccent: Record<PeopleTone, GenreAccent> = { 1: "clay", 2: "ochre", 3: "moss", 4: "plum" };

/** The accent for a title: its first genre if mapped, otherwise picked from its id. */
export function resolveGenreAccent(genres: string[], titleId: string): GenreAccent {
  const first = genres[0];
  if (first && first in genreAccent) return genreAccent[first];
  return toneAccent[peopleTone(titleId)];
}

export function accentToTone(accent: GenreAccent): PeopleTone {
  return accentTone[accent];
}
