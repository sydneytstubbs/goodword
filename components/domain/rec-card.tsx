"use client";

import NextLink from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fullTime, nameList, relativeTime } from "@/lib/format";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Avatar, AvatarStack } from "../ui/avatar";
import { LabelBadge, UnreadDot } from "../ui/badge";
import { GroupChip } from "../ui/chip";
import { Poster } from "./poster";
import { cardAccessibleName, titleMeta, vouchedByCompact } from "./title-meta";
import type { GoodWord, Group, Title } from "./types";

// Rec card (DESIGN-SYSTEM.md 4.2.2): one component, three variants.
// The whole card is one link to the detail screen, named as a sentence.

type Common = {
  title: Title;
  goodWords: GoodWord[];
  viewerId?: string;
};

export function VouchedByRow({ goodWords, viewerId }: { goodWords: GoodWord[]; viewerId?: string }) {
  if (goodWords.length === 0) return null;
  return (
    // Names wrap rather than truncate: never fewer than 8 visible characters (DS 3.2.2).
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
      <AvatarStack people={goodWords.map((g) => g.person)} size={24} />
      <span className="text-caption text-muted">{vouchedByCompact(goodWords, viewerId)}</span>
    </span>
  );
}

function latestNote(goodWords: GoodWord[]): string | undefined {
  return [...goodWords].filter((g) => g.note).sort((a, b) => b.at.getTime() - a.at.getTime())[0]?.note;
}

/** grid: shelves. No card box; the poster is the object. */
export function RecCardGrid({
  title,
  goodWords,
  viewerId,
  href,
  isNew = false,
  commentCount = 0,
  unseenComments = false,
  eager,
  shelves,
  className,
}: Common & {
  href: string;
  isNew?: boolean;
  commentCount?: number;
  unseenComments?: boolean;
  eager?: boolean;
  /** My shelf: the groups it's shared into; empty means "Only you" (PRD F5.3). */
  shelves?: Group[];
  className?: string;
}) {
  const note = latestNote(goodWords);
  return (
    <NextLink
      href={href}
      aria-label={
        shelves
          ? `${cardAccessibleName(title, goodWords, viewerId)} ${
              shelves.length === 0 ? t("vouch.onlyYou") : t("vouch.sharedIn", { groups: nameList(shelves.map((g) => g.name)) })
            }.`
          : cardAccessibleName(title, goodWords, viewerId)
      }
      className={cn("group flex flex-col gap-2.5 rounded-poster", className)}
    >
      <span className="relative block">
        <Poster title={title} eager={eager} className="transition-shadow duration-fast ease-standard group-hover:shadow-md" />
        {isNew && <LabelBadge className="absolute top-2 start-2" />}
      </span>
      <span className="flex flex-col gap-1">
        <span className="line-clamp-2 text-card-title text-default">{title.name}</span>
        <span className="flex items-center gap-2 text-caption text-muted">
          {titleMeta(title)}
          {commentCount > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Icon name="comment" size={16} />
              {commentCount}
              {unseenComments && <UnreadDot size={6} />}
            </span>
          )}
        </span>
      </span>
      <VouchedByRow goodWords={goodWords} viewerId={viewerId} />
      {note && <span className="line-clamp-2 text-caption text-muted">“{note}”</span>}
      {shelves && (
        <span className="flex flex-wrap gap-1">
          {shelves.length === 0 ? (
            <span className="inline-flex items-center gap-1 text-caption text-muted">
              <Icon name="private" size={16} />
              {t("vouch.onlyYou")}
            </span>
          ) : (
            shelves.map((group) => <GroupChip key={group.id} group={group} />)
          )}
        </span>
      )}
    </NextLink>
  );
}

/** row: search results and dense lists. The vouch button is a separate target. */
export function RecCardRow({
  title,
  goodWords,
  viewerId,
  href,
  annotation,
  trailing,
}: Common & {
  href: string;
  /** Replaces the vouched-by row, e.g. "On your shelf" in search. */
  annotation?: ReactNode;
  /** The vouch button. */
  trailing?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-subtle py-3">
      <NextLink
        href={href}
        aria-label={cardAccessibleName(title, goodWords, viewerId)}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-control"
      >
        <Poster title={title} size="row" />
        <span className="flex min-w-0 flex-col gap-1">
          <span className="line-clamp-2 text-card-title text-default">{title.name}</span>
          <span className="text-caption text-muted">{titleMeta(title)}</span>
          {annotation ?? <VouchedByRow goodWords={goodWords} viewerId={viewerId} />}
        </span>
      </NextLink>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}

/**
 * detail: the title screen. Order per 4.2.2: poster, title, meta, genres,
 * where to watch, each friend's good word, then the vouch button.
 */
export function RecCardDetail({
  title,
  goodWords,
  viewerId,
  headingLevel = 1,
  whereToWatch,
  vouchButton,
  noGoodWords,
  now,
}: Common & {
  /** title-l is the page's h1 (DS 3.2.2); /styleguide renders it lower. */
  headingLevel?: 1 | 2 | 3 | 4;
  whereToWatch?: ReactNode;
  vouchButton: ReactNode;
  /** Shown when nobody in your groups has vouched for it yet (PRD F6). */
  noGoodWords?: ReactNode;
  now?: Date;
}) {
  const Heading = `h${headingLevel}` as const;
  const SubHeading = `h${headingLevel + 1}` as "h2" | "h3" | "h4" | "h5";
  // Step down to 44px when 56px would need three lines (DS 3.2.2).
  const long = title.name.length > 22;
  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-10">
      <Poster title={title} size="detail" eager className="lg:w-72" />
      <div className="flex min-w-0 flex-1 flex-col gap-6">
        <div className="flex flex-col gap-3">
          <Heading className={cn("text-default", long ? "text-title-l-step" : "text-title-l")}>{title.name}</Heading>
          <p className="text-caption text-muted">{titleMeta(title, true)}</p>
          {title.genres.length > 0 && (
            <p className="text-caption text-muted">
              <span className="sr-only">{t("title.genres")}: </span>
              {title.genres.join(t("title.metaSeparator"))}
            </p>
          )}
        </div>
        {whereToWatch && (
          <section className="flex flex-col gap-2">
            <SubHeading className="flex items-center gap-2 text-heading text-default">
              <Icon name="whereToWatch" size={20} />
              {t("title.whereToWatch")}
            </SubHeading>
            {whereToWatch}
          </section>
        )}
        {goodWords.length === 0 && noGoodWords && <p className="text-body text-muted">{noGoodWords}</p>}
        {goodWords.length > 0 && (
          <section aria-label={t("title.goodWords")} className="flex flex-col gap-6">
            {goodWords.map((g) => (
              <figure key={g.person.id} className="flex flex-col gap-2">
                <figcaption className="flex items-center gap-3">
                  <Avatar person={g.person} size={32} decorative />
                  <span className="text-body-strong text-default">
                    {g.person.id === viewerId ? t("common.you") : g.person.name}
                  </span>
                  <time dateTime={g.at.toISOString()} title={fullTime(g.at)} className="text-caption text-muted">
                    {relativeTime(g.at, now)}
                  </time>
                </figcaption>
                {g.note && <blockquote className="text-quote text-default">“{g.note}”</blockquote>}
              </figure>
            ))}
          </section>
        )}
        <div>{vouchButton}</div>
      </div>
    </div>
  );
}
