import NextLink from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fullTime, relativeTime } from "@/lib/format";
import { t, tPlain, tRich } from "@/lib/messages";
import { Avatar } from "../ui/avatar";
import { UnreadDot } from "../ui/badge";
import { Poster } from "./poster";
import type { Group, Person, Title } from "./types";

// Activity item (DESIGN-SYSTEM.md 4.2.13): one sentence naming the person,
// the action, the title, and the group. The whole row links to the exact
// comment; opening it marks it read. A friend request isn't a link: its
// Accept and Decline sit in the item (PRD F16.9).

export type ActivityKind =
  | "mention"
  | "comment"
  | "started"
  | "join"
  | "friendRequest"
  | "friendAccepted"
  // Under a good word (PRD F16.9): someone else's, or yours.
  | "mentionWord"
  | "mentionYourWord"
  | "commentWord"
  | "commentYourWord";

export function ActivityItem({
  kind,
  actor,
  actorNames,
  title,
  group,
  wordAuthor,
  quote,
  spoiler = false,
  at,
  unread = false,
  href,
  now,
  onOpen,
  actions,
}: {
  kind: ActivityKind;
  /** The avatar: the most recent person. */
  actor: Person;
  /** Collapsed items name everyone: "Jonah and Tess" (PRD F14). */
  actorNames?: string;
  title?: Title;
  /** Friend items, and comments under a good word, have no group. */
  group?: Group;
  /** Whose good word the comment is under (the *Word kinds). */
  wordAuthor?: string;
  /** The comment, quoted on one line. */
  quote?: string;
  /** Spoiler comments are never previewed (DS 4.2.12). */
  spoiler?: boolean;
  at: Date;
  unread?: boolean;
  /** Where the row goes. Without it, the row isn't a link and shows `actions`. */
  href?: string;
  /** Buttons in the item instead of a link (friend requests). */
  actions?: ReactNode;
  now?: Date;
  /** Opening an item marks it read (PRD F14). */
  onOpen?: () => void;
}) {
  const vars = { actor: actorNames ?? actor.name, title: title?.name ?? "", group: group?.name ?? "", author: wordAuthor ?? "" };
  const preview = spoiler ? t("spoiler.preview") : quote && `“${quote}”`;
  const rowClass = cn("flex items-start gap-3 border-b border-subtle px-5 py-3", unread && "bg-action-wash");
  const content = (
    <>
      <span className="flex w-2 shrink-0 self-center">
        {unread && <UnreadDot label={t("common.unread")} />}
      </span>
      <Avatar person={actor} size={40} decorative />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className={cn("text-body text-default", unread && "font-semibold")}>
          <span aria-hidden="true">{tRich(`activity.${kind}`, vars)}</span>
          <span className="sr-only">{tPlain(`activity.${kind}`, vars)}</span>
        </span>
        {preview && <span className={cn("truncate text-caption text-muted", spoiler && "italic")}>{preview}</span>}
        <time dateTime={at.toISOString()} title={fullTime(at)} className="text-caption text-muted">
          {relativeTime(at, now)}
        </time>
        {!href && actions && <span className="mt-2 flex flex-wrap gap-3">{actions}</span>}
      </span>
      {title && <Poster title={title} size="activity" />}
    </>
  );
  if (!href) {
    return (
      <div className={rowClass}>{content}</div>
    );
  }
  return (
    <NextLink href={href} onClick={onOpen} className={cn(rowClass, "transition duration-fast ease-standard hover:bg-surface-hover")}>
      {content}
    </NextLink>
  );
}
