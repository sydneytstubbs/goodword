"use client";

import NextLink from "next/link";
import { useId, type ReactNode } from "react";
import { wordConversationHref } from "@/lib/conversations/paths";
import type { WordConversationPreview } from "@/lib/conversations/types";
import { fullTime, relativeTime } from "@/lib/format";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Avatar } from "../ui/avatar";
import { UnreadDot } from "../ui/badge";
import { PreviewComment } from "./conversation-preview";
import { GoodWordGroups } from "./rec-card";
import type { GoodWord, Title } from "./types";

// The good words on the title page (PRD F16.4, DS 5.7): every good word you
// can see, yours first (or the vouch button in its place), then newest first.
// Each reads as the first comment of its conversation: who, when, and the
// note (still a note, DS 1.4). Under each one shared with friends, its
// conversation (F16.5) is open: its 3 newest comments, "See all 12
// comments", and "Add a comment…" (DS 5.17). Nothing hints at good words or
// conversations you can't see (F16.6 rule 4).

export type TitlePageGoodWord = GoodWord & { goodWordId: string; conversation?: WordConversationPreview };

/** A good word's conversation, open beneath it: the newest comments, See all, and Add a comment. */
export function WordConversationRow({
  title,
  goodWordId,
  conversation,
  ownerName,
  viewerId,
  now,
}: {
  title: Title;
  goodWordId: string;
  conversation: WordConversationPreview;
  /** Whose good word: "Jonah's good word", or null for yours. */
  ownerName: string | null;
  viewerId: string;
  now?: Date;
}) {
  const href = wordConversationHref(title, goodWordId);
  const compose = wordConversationHref(title, goodWordId, { compose: true });
  const under = ownerName === null ? t("title.wordConversationForYours") : t("title.wordConversationFor", { name: ownerName });
  return (
    <div className="flex flex-col gap-4">
      {conversation.count > conversation.recent.length && (
        <NextLink
          href={href}
          className="-mx-2 flex min-h-target items-center gap-2 self-start rounded-control px-2 text-caption text-muted transition duration-fast ease-standard hover:bg-surface-hover"
        >
          <span className="tabular-nums">{t("conversation.seeAll", { count: conversation.count })}</span>
          {conversation.unseen && <UnreadDot size={6} label={t("title.unseenComments")} />}
          <span className="sr-only">, {under}</span>
        </NextLink>
      )}
      {conversation.recent.length > 0 && (
        <ol aria-label={`${t("comment.list")}, ${under}`} className="flex flex-col gap-4">
          {conversation.recent.map((comment) => (
            <PreviewComment key={comment.id} comment={comment} viewerId={viewerId} now={now} />
          ))}
        </ol>
      )}
      <NextLink
        href={compose}
        className="flex min-h-target items-center rounded-pill border border-strong bg-surface-raised px-4 text-body text-muted transition duration-fast ease-standard hover:bg-surface-hover fc-edge"
      >
        {t("conversation.addComment")}
        <span className="sr-only">, {under}</span>
      </NextLink>
    </div>
  );
}

export function TitleGoodWords({
  title,
  goodWords,
  viewerId,
  vouchButton,
  noGoodWords,
  headingLevel = 2,
  now,
}: {
  title: Title;
  /** Yours first, if you have one, then newest first. */
  goodWords: TitlePageGoodWord[];
  viewerId: string;
  /** Under your good word, or in its place when you haven't put one in. */
  vouchButton: ReactNode;
  /** Shown when nobody you know has vouched for it. */
  noGoodWords: string;
  headingLevel?: 2 | 3 | 4 | 5;
  now?: Date;
}) {
  const Heading = `h${headingLevel}` as const;
  const headingId = useId();
  const mineFirst = goodWords[0]?.person.id === viewerId;
  const others = mineFirst ? goodWords.slice(1) : goodWords;

  // The good word reads as the first comment of its conversation (DS 1.4, 5.7).
  const item = (g: TitlePageGoodWord, mine: boolean) => (
    <li key={g.goodWordId} className="flex flex-col gap-4 border-b border-subtle pb-6 last:border-b-0">
      <figure className="flex gap-3">
        <Avatar person={g.person} size={32} decorative className="mt-1" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <figcaption className="flex flex-wrap items-center gap-x-2">
            {mine ? (
              <span className="inline-flex min-h-target items-center text-body-strong text-default">{t("common.you")}</span>
            ) : (
              <NextLink
                href={`/people/${g.person.id}`}
                className="inline-flex min-h-target items-center rounded-control text-body-strong text-default underline-offset-4 hover:underline"
              >
                {g.person.name}
              </NextLink>
            )}
            <time dateTime={g.at.toISOString()} title={fullTime(g.at)} className="text-caption text-muted">
              {relativeTime(g.at, now)}
            </time>
          </figcaption>
          {g.note && <blockquote className="text-body text-default break-words">{g.note}</blockquote>}
          {(mine || (g.groups && g.groups.length > 0)) && <GoodWordGroups groups={g.groups ?? []} friends={g.friends} />}
        </div>
      </figure>
      {mine && <div>{vouchButton}</div>}
      {g.conversation && (
        <WordConversationRow
          title={title}
          goodWordId={g.goodWordId}
          conversation={g.conversation}
          ownerName={mine ? null : g.person.name}
          viewerId={viewerId}
          now={now}
        />
      )}
    </li>
  );

  return (
    // A labeled group, not a region: without the flag, title detail's own good
    // words region has the same name (axe landmark-unique on /styleguide).
    <div role="group" aria-labelledby={headingId} className="flex flex-col gap-4">
      <Heading id={headingId} className="flex items-center gap-2 text-heading text-default">
        <Icon name="vouched" size={20} />
        {t("title.goodWordsHeading")}
      </Heading>
      {/* Yours first; if you haven't put one in, the vouch button takes its place (F16.4). */}
      {!mineFirst && <div>{vouchButton}</div>}
      {others.length === 0 && <p className="text-body text-muted">{noGoodWords}</p>}
      {goodWords.length > 0 && (
        <ul className="flex flex-col gap-6">
          {mineFirst && item(goodWords[0], true)}
          {others.map((g) => item(g, false))}
        </ul>
      )}
    </div>
  );
}
