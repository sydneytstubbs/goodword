import type { GenreAccent } from "@/lib/genre-accent";
import type { Person } from "../ui/avatar";
import type { Group } from "../ui/chip";

export type { Person, Group };

export type TitleType = "movie" | "tv";

export type Title = {
  id: string;
  type: TitleType;
  name: string;
  year: number;
  /** Minutes, for films. */
  runtime?: number;
  genres: string[];
  /** Resolved once when the title is first saved (DS 4.2.1). */
  accent: GenreAccent;
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
