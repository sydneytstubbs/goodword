"use client";

import NextLink from "next/link";
import { useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { wordConversationHref } from "@/lib/conversations/paths";
import type { WordConversationPreview } from "@/lib/conversations/types";
import { fullTime, relativeTime } from "@/lib/format";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Avatar } from "../ui/avatar";
import { UnreadDot } from "../ui/badge";
import { TextLink } from "../ui/text-link";
import { PreviewComment } from "./conversation-preview";
import { GoodWordGroups } from "./rec-card";
import type { GoodWord, Title } from "./types";
import { plainText } from "@/lib/conversations/body";

// The good words on the title page (PRD F16.4, DS 5.7): every good word you
// can see, yours first (or the vouch button in its place), then newest first.
// Under each one shared with friends, its conversation (F16.5) is collapsed
// to its count and latest comment, and opens in place to its 3 newest, "See
// all 12 comments", and "Add a comment…" (DS 5.17). Nothing hints at good
// words or conversations you can't see (F16.6 rule 4).

export type TitlePageGoodWord = GoodWord & { goodWordId: string; conversation?: WordConversationPreview };

/** A good word's conversation, collapsed beneath it. */
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
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const href = wordConversationHref(title, goodWordId);
  const compose = wordConversationHref(title, goodWordId, { compose: true });
  const under = ownerName === null ? t("title.wordConversationForYours") : t("title.wordConversationFor", { name: ownerName });
  const latest = conversation.recent.at(-1);
  const rowClass =
    "-mx-2 flex min-h-target w-full items-center gap-2 rounded-control px-2 text-start text-caption text-muted transition duration-fast ease-standard hover:bg-surface-hover";

  if (conversation.count === 0) {
    return (
      <NextLink href={compose} className={rowClass}>
        <Icon name="comment" size={16} className="shrink-0" />
        <span>{t("home.saySomething")}</span>
        <span className="sr-only">, {under}</span>
      </NextLink>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <button type="button" aria-expanded={open} aria-controls={regionId} onClick={() => setOpen((o) => !o)} className={rowClass}>
        <Icon name="comment" size={16} className="shrink-0" />
        <span className="shrink-0 tabular-nums">{t("title.comments", { count: conversation.count })}</span>
        {conversation.unseen && <UnreadDot size={6} label={t("title.unseenComments")} />}
        <span className="sr-only">, {under}</span>
        {!open && latest && (
          <span aria-hidden="true" className={cn("min-w-0 truncate", latest.spoiler && "italic")}>
            · {latest.author.name}: {latest.spoiler ? t("spoiler.preview") : plainText(latest.body)}
          </span>
        )}
      </button>
      <div id={regionId} hidden={!open} className="flex flex-col gap-4 ps-2">
        <ol aria-label={t("comment.list")} className="flex flex-col gap-4">
          {conversation.recent.map((comment) => (
            <PreviewComment key={comment.id} comment={comment} viewerId={viewerId} now={now} />
          ))}
        </ol>
        <TextLink href={href} variant="standalone" className="self-start">
          {t("conversation.seeAll", { count: conversation.count })}
        </TextLink>
        <NextLink
          href={compose}
          className="flex min-h-target items-center rounded-pill border border-strong bg-surface-raised px-4 text-body text-muted transition duration-fast ease-standard hover:bg-surface-hover fc-edge"
        >
          {t("conversation.addComment")}
        </NextLink>
      </div>
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

  const item = (g: TitlePageGoodWord, mine: boolean) => (
    <li key={g.goodWordId} className="flex flex-col gap-3">
      <figure className="flex flex-col gap-2">
        <figcaption className="flex items-center gap-3">
          <Avatar person={g.person} size={32} decorative />
          {mine ? (
            <span className="text-body-strong text-default">{t("common.you")}</span>
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
        {g.note && <blockquote className="text-quote text-default break-words">“{g.note}”</blockquote>}
        {(mine || (g.groups && g.groups.length > 0)) && <GoodWordGroups groups={g.groups ?? []} friends={g.friends} />}
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
