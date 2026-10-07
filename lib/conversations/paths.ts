import type { TitleType } from "@/components/domain/types";

// Conversation routes (PRD 6.1): /title/[type]/[tmdbId]/conversation?group=
// for a group's conversation, and ?word= for the one under a good word (F16.5).

/** A group's conversation about a title; `comment` lands on one, `compose` focuses the composer. */
export function conversationHref(
  title: { type: TitleType; tmdbId?: number },
  groupId: string,
  options: { comment?: string; compose?: boolean } = {},
): string {
  const params = new URLSearchParams({ group: groupId });
  if (options.comment) params.set("comment", options.comment);
  if (options.compose) params.set("compose", "1");
  return `/title/${title.type}/${title.tmdbId ?? 0}/conversation?${params}`;
}

/** The conversation under a good word; `comment` lands on one, `compose` focuses the composer. */
export function wordConversationHref(
  title: { type: TitleType; tmdbId?: number },
  goodWordId: string,
  options: { comment?: string; compose?: boolean } = {},
): string {
  const params = new URLSearchParams({ word: goodWordId });
  if (options.comment) params.set("comment", options.comment);
  if (options.compose) params.set("compose", "1");
  return `/title/${title.type}/${title.tmdbId ?? 0}/conversation?${params}`;
}

/** The conversation screen hides the tab bar and header below 1024px (PRD 6.2). */
export function isConversationPath(pathname: string): boolean {
  return /^\/title\/(?:movie|tv)\/\d+\/conversation$/.test(pathname);
}
