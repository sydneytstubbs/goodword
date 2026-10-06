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
  /** Title detail: which of the viewer's groups it's shared into (PRD F6). Empty is "Only you". */
  groups?: Group[];
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

/** How someone arrived when they put in a good word (PRD 11.3). */
export type GoodWordSource = "organic" | "digest" | "nudge_email" | "join_prompt" | "share" | "import";

/** The viewer's own good word on a title (PRD F4): one note, any number of their groups. */
export type MyGoodWord = {
  /** Empty when there's no note. */
  note: string;
  groupIds: string[];
  createdAt: string;
  source: GoodWordSource;
  /** When it went on each list, by group id, so Undo restores it exactly. */
  sharedAt: Record<string, string>;
};

/** One card per title per list (PRD F4): everyone who vouched, newest first. */
export type ListCard = {
  title: Title;
  goodWords: GoodWord[];
  /** My list only: the viewer's groups it's shared into. */
  groupIds?: string[];
  /** A good word from someone else since the viewer last looked at this list (PRD F5.5). */
  isNew?: boolean;
  /** Streaming services (TMDB provider ids) in the viewer's region. Unknown until fetched. */
  services?: number[];
  /** Comments on it in this list's groups, and whether any are unseen (DS 4.2.2, PRD F13). */
  comments?: { count: number; unseen: boolean };
};

/** A streaming service on a list, for the services filter (PRD F5.4). */
export type Service = { id: number; name: string };

/** A list's cards, and the streaming services on it in the viewer's region. */
export type List = { cards: ListCard[]; services: Service[] };
