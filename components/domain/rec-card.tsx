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
  /** My Recs: the groups it's shared into; empty means "Only you" (PRD F5.3). */
  shelves?: Group[];
  className?: string;
}) {
  const note = latestNote(goodWords);
  return (
    <NextLink
      href={href}
      aria-label={[
        cardAccessibleName(title, goodWords, viewerId),
        shelves &&
          `${shelves.length === 0 ? t("vouch.onlyYou") : t("vouch.sharedIn", { groups: nameList(shelves.map((g) => g.name)) })}.`,
        // The badge is inside the link, so its text goes in the name (DS 4.1.11).
        isNew && `${t("common.new")}.`,
        commentCount > 0 && `${t("title.comments", { count: commentCount })}.`,
        commentCount > 0 && unseenComments && `${t("title.unseenComments")}.`,
      ]
        .filter(Boolean)
        .join(" ")}
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
 * detail: the title screen (DS 4.2.2, 5.7; PRD F6). Friends first: poster,
 * title, meta, and genres; each friend's good word with the chips of your
 * groups it's in; where to watch; the vouch button; then the overview.
 */
export function RecCardDetail({
  title,
  goodWords,
  viewerId,
  headingLevel = 1,
  whereToWatch,
  vouchButton,
  noGoodWords,
  conversation,
  overview,
  now,
}: Common & {
  /** title-l is the page's h1 (DS 3.2.2); /styleguide renders it lower. */
  headingLevel?: 1 | 2 | 3 | 4;
  whereToWatch?: ReactNode;
  vouchButton: ReactNode;
  /** Shown when nobody in your groups has vouched for it yet (PRD F6). */
  noGoodWords?: ReactNode;
  /** The conversation preview, after the vouch button (DS 5.7, 5.17). */
  conversation?: ReactNode;
  /** Last, collapsed to three lines with More. */
  overview?: ReactNode;
  now?: Date;
}) {
  const Heading = `h${headingLevel}` as const;
  const SubHeading = `h${headingLevel + 1}` as "h2" | "h3" | "h4" | "h5";
  // Step down to 44px when 56px would need three lines (DS 3.2.2).
  const long = title.name.length > 22;
  // Side by side on desktop, when there's room: beside a conversation panel
  // at 1024px it stays stacked (DS 5.17).
  return (
    <div className="@container">
      <div className="flex flex-col gap-6 lg:@2xl:flex-row lg:@2xl:items-start lg:@2xl:gap-10">
        <Poster title={title} size="detail" eager className="lg:@2xl:w-72" />
        <div className="flex min-w-0 flex-1 flex-col gap-8">
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
          {goodWords.length === 0 && noGoodWords && <p className="text-body text-muted">{noGoodWords}</p>}
          {goodWords.length > 0 && (
            <section aria-label={t("title.goodWords")} className="flex flex-col gap-6">
              {goodWords.map((g) => (
                <figure key={g.person.id} className="flex flex-col gap-2">
                  <figcaption className="flex items-center gap-3">
                    <Avatar person={g.person} size={32} decorative />
                    {g.person.id === viewerId ? (
                      <span className="text-body-strong text-default">{t("common.you")}</span>
                    ) : (
                      // Their good words in groups you share (PRD F8).
                      <NextLink href={`/people/${g.person.id}`} className="inline-flex min-h-target items-center rounded-control text-body-strong text-default underline-offset-4 hover:underline">
                        {g.person.name}
                      </NextLink>
                    )}
                    <time dateTime={g.at.toISOString()} title={fullTime(g.at)} className="text-caption text-muted">
                      {relativeTime(g.at, now)}
                    </time>
                  </figcaption>
                  {g.note && <blockquote className="text-quote text-default">“{g.note}”</blockquote>}
                  {g.groups && <GoodWordGroups groups={g.groups} />}
                </figure>
              ))}
            </section>
          )}
          {whereToWatch && (
            <section className="flex flex-col gap-3">
              <SubHeading className="flex items-center gap-2 text-heading text-default">
                <Icon name="whereToWatch" size={20} />
                {t("title.whereToWatch")}
              </SubHeading>
              {whereToWatch}
            </section>
          )}
          <div>{vouchButton}</div>
          {conversation}
          {overview && (
            <section className="flex flex-col gap-2">
              <SubHeading className="sr-only">{t("title.overview")}</SubHeading>
              {overview}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

/** Which of the viewer's groups a good word is in; "Only you" when none (PRD F6). */
function GoodWordGroups({ groups }: { groups: Group[] }) {
  if (groups.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-caption text-muted">
        <Icon name="private" size={16} />
        {t("vouch.onlyYou")}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      <span className="sr-only">{t("vouch.sharedIn", { groups: nameList(groups.map((g) => g.name)) })}</span>
      {groups.map((group) => (
        <span key={group.id} aria-hidden="true">
          <GroupChip group={group} />
        </span>
      ))}
    </span>
  );
}
