"use client";

import NextLink from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fullTime, nameList, relativeTime } from "@/lib/format";
import { t, tRich } from "@/lib/messages";
import { Icon } from "../icon";
import { Avatar, AvatarStack } from "../ui/avatar";
import { Button } from "../ui/button";
import { ButtonLink } from "../ui/button-link";
import { TextLink } from "../ui/text-link";
import { LabelBadge, UnreadDot } from "../ui/badge";
import { GroupChip, FriendsChip } from "../ui/chip";
import { Poster } from "./poster";
import { cardAccessibleName, titleMeta, vouchedByCompact } from "./title-meta";
import type { GoodWord, Group, ListCard, Person, Title } from "./types";

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

/** grid: lists. No card box; the poster is the object. */
export function RecCardGrid({
  title,
  goodWords,
  viewerId,
  href,
  isNew = false,
  commentCount = 0,
  unseenComments = false,
  eager,
  lists,
  friends = false,
  className,
}: Common & {
  href: string;
  isNew?: boolean;
  commentCount?: number;
  unseenComments?: boolean;
  eager?: boolean;
  /** My list: the groups it's shared into; empty means "Only you" (PRD F5.3). */
  lists?: Group[];
  /** My list: shared with your friends too (PRD F16.2). */
  friends?: boolean;
  className?: string;
}) {
  const note = latestNote(goodWords);
  return (
    <NextLink
      href={href}
      aria-label={[
        cardAccessibleName(title, goodWords, viewerId),
        lists && sharedLabel(lists, friends),
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
      {lists && (
        <span className="flex flex-wrap gap-1">
          {lists.length === 0 && !friends ? (
            <span className="inline-flex items-center gap-1 text-caption text-muted">
              <Icon name="private" size={16} />
              {t("vouch.onlyYou")}
            </span>
          ) : (
            <>
              {friends && <FriendsChip label={t("vouch.friendsChip")} />}
              {lists.map((group) => (
                <GroupChip key={group.id} group={group} />
              ))}
            </>
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
  /** Replaces the vouched-by row, e.g. "On your list" in search. */
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
  people,
  now,
}: Common & {
  /** title-l is the page's h1 (DS 3.2.2); /styleguide renders it lower. */
  headingLevel?: 1 | 2 | 3 | 4;
  whereToWatch?: ReactNode;
  /** Without `people`, the vouch button follows where to watch. */
  vouchButton?: ReactNode;
  /** Shown when nobody in your groups has vouched for it yet (PRD F6). */
  noGoodWords?: ReactNode;
  /** The conversation preview, after the vouch button (DS 5.7, 5.17). */
  conversation?: ReactNode;
  /** Last, collapsed to three lines with More. */
  overview?: ReactNode;
  /**
   * The title page with friends (PRD F16.4): the good words you can see, each
   * with its conversation, in place of the good words and vouch button here.
   * Where to watch then comes first, with the title.
   */
  people?: ReactNode;
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
          {!people && goodWords.length === 0 && noGoodWords && <p className="text-body text-muted">{noGoodWords}</p>}
          {!people && goodWords.length > 0 && (
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
                  {g.groups && <GoodWordGroups groups={g.groups} friends={g.friends} />}
                </figure>
              ))}
            </section>
          )}
          {whereToWatch && (
            <section id="where-to-watch" className="flex scroll-mt-20 flex-col gap-3">
              <SubHeading className="flex items-center gap-2 text-heading text-default">
                <Icon name="whereToWatch" size={20} />
                {t("title.whereToWatch")}
              </SubHeading>
              {whereToWatch}
            </section>
          )}
          {people ?? <div>{vouchButton}</div>}
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

/** "Shared with your friends. On College crew." or "Only you." for a card's accessible name. */
function sharedLabel(groups: Group[], friends: boolean): string {
  const parts = [
    friends && `${t("vouch.sharedWithFriends")}.`,
    groups.length > 0 && `${t("vouch.sharedIn", { groups: nameList(groups.map((g) => g.name)) })}.`,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : `${t("vouch.onlyYou")}.`;
}

/** Which of the viewer's groups a good word is in, and friends; "Only you" when none (PRD F6, F16.2). */
export function GoodWordGroups({ groups, friends = false }: { groups: Group[]; friends?: boolean }) {
  if (groups.length === 0 && !friends) {
    return (
      <span className="inline-flex items-center gap-1 text-caption text-muted">
        <Icon name="private" size={16} />
        {t("vouch.onlyYou")}
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      <span className="sr-only">{sharedLabel(groups, friends)}</span>
      {friends && (
        <span aria-hidden="true">
          <FriendsChip label={t("vouch.friendsChip")} />
        </span>
      )}
      {groups.map((group) => (
        <span key={group.id} aria-hidden="true">
          <GroupChip group={group} />
        </span>
      ))}
    </span>
  );
}

/** "Jonah", "Jonah and Tess", "Jonah, Tess and 2 more"; you're "You" (DS 4.2.2 home). */
export function homeWho(goodWords: GoodWord[], viewerId: string): string {
  const names = goodWords.map((g) => (g.person.id === viewerId ? t("common.you") : g.person.name));
  if (names.length === 1) return names[0];
  if (names.length === 2) return t("home.whoTwo", { a: names[0], b: names[1] });
  return t("home.whoMore", { a: names[0], b: names[1], count: names.length - 2 });
}

/**
 * home (Home, DS 5.19): leads with the friend's words, not the poster. Who
 * vouched, the newest note in full, the title (the link to title detail),
 * the conversation row, and the actions. Never likes, counts of views, or
 * sharing outside Good Word. Several targets, so the card itself isn't a link.
 */
export function RecCardHome({
  card,
  viewerId,
  href,
  conversationHref,
  whereToWatchHref,
  group,
  vouchButton,
  now,
}: {
  card: ListCard;
  viewerId: string;
  /** Title detail. */
  href: string;
  /** The conversation to open from the conversation row and Comment. */
  conversationHref: string;
  whereToWatchHref: string;
  /** The group it reached you through, when nothing on it came through friendship. */
  group?: Group;
  /** Vouch too, or Your good word once you've vouched. */
  vouchButton: ReactNode;
  now?: Date;
}) {
  const { title, goodWords } = card;
  const who = homeWho(goodWords, viewerId);
  const newest = goodWords[0];
  // Home leads with a friend's words: the newest note from someone else (yours only if theirs are missing).
  const note = (goodWords.find((g) => g.person.id !== viewerId) ?? newest)?.note;
  const comments = card.comments?.count ?? 0;
  const latest = card.latestComment;
  return (
    <article aria-label={t("home.cardName", { who, title: title.name })} className="flex flex-col gap-4 border-b border-subtle py-6">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <AvatarStack people={goodWords.map((g) => g.person)} size={24} ring="surface" />
        <span className="text-body-strong text-default">{who}</span>
        {newest && (
          <time dateTime={newest.at.toISOString()} title={fullTime(newest.at)} className="text-caption text-muted">
            {relativeTime(newest.at, now)}
          </time>
        )}
        {group && <GroupChip group={group} />}
      </div>
      {note && <p className="text-quote text-default break-words">“{note}”</p>}
      {goodWords.length > 1 && (
        <TextLink href={href} variant="standalone" className="self-start">
          {t("home.seeAll", { count: goodWords.length })}
        </TextLink>
      )}
      <NextLink href={href} className="group flex items-center gap-3 self-start rounded-control">
        <span className="relative">
          <Poster title={title} size="row" />
          {card.isNew && <LabelBadge className="absolute -top-2 start-1" />}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="line-clamp-2 text-card-title text-default group-hover:underline">{title.name}</span>
          <span className="text-caption text-muted">{titleMeta(title)}</span>
        </span>
      </NextLink>
      <NextLink
        href={conversationHref}
        className="-mx-2 flex min-h-target items-center gap-2 rounded-control px-2 text-caption text-muted transition duration-fast ease-standard hover:bg-surface-hover"
      >
        <Icon name="comment" size={16} className="shrink-0" />
        {comments > 0 ? (
          <>
            <span className="tabular-nums">{t("title.comments", { count: comments })}</span>
            {card.comments?.unseen && <UnreadDot size={6} label={t("title.unseenComments")} />}
            {latest && (
              <span className={cn("min-w-0 truncate", latest.text === null && "italic")}>
                · {latest.authorName}: {latest.text === null ? t("spoiler.preview") : latest.text}
              </span>
            )}
          </>
        ) : (
          <span>{t("home.saySomething")}</span>
        )}
      </NextLink>
      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink href={conversationHref} variant="ghost" icon="comment">
          {t("home.comment")}
          <span className="sr-only"> {title.name}</span>
        </ButtonLink>
        {vouchButton}
        <ButtonLink href={whereToWatchHref} variant="ghost" icon="whereToWatch">
          {t("title.whereToWatch")}
          <span className="sr-only"> {title.name}</span>
        </ButtonLink>
      </div>
    </article>
  );
}

/** The caught-up marker (DS 4.2.14): Home ends here; earlier good words load only on a tap. */
export function CaughtUpMarker({ onEarlier, children }: { onEarlier?: () => void; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8">
      <div className="flex w-full items-center gap-3">
        <span aria-hidden="true" className="flex-1 border-t border-subtle" />
        <Icon name="vouched" size={16} className="text-muted" />
        <h2 className="text-body-strong text-default">{t("home.caughtUp")}</h2>
        <span aria-hidden="true" className="flex-1 border-t border-subtle" />
      </div>
      {children}
      {onEarlier && (
        <Button variant="ghost" onClick={onEarlier}>
          {t("home.earlier")}
        </Button>
      )}
    </div>
  );
}

/** One quiet line for a friend's import (DS 4.2.15), linking to their person view. */
export function ImportRollupLine({ person, count, at, now }: { person: Person; count: number; at: Date; now?: Date }) {
  return (
    <NextLink
      href={`/people/${person.id}`}
      className="-mx-2 flex min-h-target items-center gap-3 rounded-control border-b border-subtle px-2 py-3 transition duration-fast ease-standard hover:bg-surface-hover"
    >
      <Avatar person={person} size={24} decorative />
      <span className="min-w-0 flex-1 text-body text-default">{tRich("home.rollup", { name: person.name, count })}</span>
      <time dateTime={at.toISOString()} title={fullTime(at)} className="text-caption text-muted">
        {relativeTime(at, now)}
      </time>
    </NextLink>
  );
}

