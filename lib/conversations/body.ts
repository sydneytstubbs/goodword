import type { CommentSegment } from "@/components/domain/types";

// Comment bodies (PRD F13, DS 4.2.11). Mentions are stored by user id as
// <@id>, so a renamed person still resolves correctly; the database keeps only
// mentions of the group's members and turns anything else into plain text.

const MENTION = /<@([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})>/g;

export const COMMENT_MAX = 500;

/** Segments to the stored form: text as typed, mentions as <@id>. */
export function encodeBody(segments: CommentSegment[]): string {
  return segments.map((s) => (s.kind === "text" ? s.text : `<@${s.userId}>`)).join("");
}

/**
 * The stored form back to segments, naming each mention from `mentions`. A
 * mention with no name (it can't normally happen) reads as plain "@".
 */
export function decodeBody(body: string, mentions: Array<{ id: string; name: string }>): CommentSegment[] {
  const names = new Map(mentions.map((m) => [m.id, m.name]));
  const segments: CommentSegment[] = [];
  const pushText = (text: string) => {
    if (!text) return;
    const last = segments.at(-1);
    if (last?.kind === "text") last.text += text;
    else segments.push({ kind: "text", text });
  };
  let at = 0;
  for (const match of body.matchAll(MENTION)) {
    pushText(body.slice(at, match.index));
    const name = names.get(match[1]);
    if (name) segments.push({ kind: "mention", userId: match[1], name });
    else pushText("@");
    at = match.index + match[0].length;
  }
  pushText(body.slice(at));
  return segments;
}

/** As people read it: "@Priya you were right". */
export function plainText(segments: CommentSegment[]): string {
  return segments.map((s) => (s.kind === "text" ? s.text : `@${s.name}`)).join("");
}

/** Trims the ends of a comment, keeping line breaks inside it. */
export function trimSegments(segments: CommentSegment[]): CommentSegment[] {
  const out = segments.map((s) => ({ ...s }));
  const first = out[0];
  if (first?.kind === "text") first.text = first.text.replace(/^\s+/, "");
  const last = out.at(-1);
  if (last?.kind === "text") last.text = last.text.replace(/\s+$/, "");
  return out.filter((s) => s.kind === "mention" || s.text.length > 0);
}

/** The ids of the people a comment mentions, once each. */
export function mentionedIds(segments: CommentSegment[]): string[] {
  return [...new Set(segments.flatMap((s) => (s.kind === "mention" ? [s.userId] : [])))];
}
