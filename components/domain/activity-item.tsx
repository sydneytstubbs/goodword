import NextLink from "next/link";
import { cn } from "@/lib/cn";
import { fullTime, relativeTime } from "@/lib/format";
import { t, tPlain, tRich } from "@/lib/messages";
import { Avatar } from "../ui/avatar";
import { UnreadDot } from "../ui/badge";
import { Poster } from "./poster";
import type { Group, Person, Title } from "./types";

// Activity item (DESIGN-SYSTEM.md 4.2.13): one sentence naming the person,
// the action, the title, and the group. The whole row links to the exact
// comment; opening it marks it read.

export type ActivityKind = "mention" | "comment" | "join";

export function ActivityItem({
  kind,
  actor,
  title,
  group,
  quote,
  spoiler = false,
  at,
  unread = false,
  href,
  now,
}: {
  kind: ActivityKind;
  actor: Person;
  title?: Title;
  group: Group;
  /** The comment, quoted on one line. */
  quote?: string;
  /** Spoiler comments are never previewed (DS 4.2.12). */
  spoiler?: boolean;
  at: Date;
  unread?: boolean;
  href: string;
  now?: Date;
}) {
  const vars = { actor: actor.name, title: title?.name ?? "", group: group.name };
  const preview = spoiler ? t("spoiler.preview") : quote && `“${quote}”`;
  return (
    <NextLink
      href={href}
      className={cn(
        "flex items-start gap-3 border-b border-subtle px-5 py-3 transition duration-fast ease-standard hover:bg-surface-hover",
        unread && "bg-action-wash",
      )}
    >
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
      </span>
      {title && <Poster title={title} size="activity" />}
    </NextLink>
  );
}
