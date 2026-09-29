import type { GenreAccent } from "@/lib/genre-accent";
import type { Person } from "../ui/avatar";
import type { Group } from "../ui/chip";

export type { Person, Group };

export type TitleType = "movie" | "tv";

export type Title = {
  /** "movie-550" or "tv-1396": the same in search results and the title cache. */
  id: string;
  type: TitleType;
  tmdbId?: number;
  name: string;
  /** Unknown for titles without a release date yet. */
  year?: number;
  /** Minutes: a film's runtime, or a show's typical episode runtime (PRD F5.4). */
  runtime?: number;
  /** Shows only. */
  seasons?: number;
  genres: string[];
  /** Resolved once when the title is first saved (DS 4.2.1). */
  accent: GenreAccent;
  /** TMDB poster path; the poster builds its size variants from it (DS 9). */
  posterPath?: string;
  /** A full image URL, for posters that don't come from TMDB. */
  posterUrl?: string;
};

export type GoodWord = {
  person: Person;
  note?: string;
  at: Date;
};

/** A comment body: text with mention tokens, stored by user id (DS 4.2.11). */
export type CommentSegment = { kind: "text"; text: string } | { kind: "mention"; userId: string; name: string };

export type CommentData = {
  id: string;
  author: Person;
  body: CommentSegment[];
  at: Date;
  edited?: boolean;
  spoiler?: boolean;
};
