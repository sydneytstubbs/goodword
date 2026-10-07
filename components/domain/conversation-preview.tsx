"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import { useId, useTransition } from "react";
import { Icon } from "../icon";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { GroupChoiceChip } from "../ui/chip";
import { ErrorState } from "../ui/empty-state";
import { Skeleton, SkeletonRegion } from "../ui/skeleton";
import { TextLink } from "../ui/text-link";
import { CommentBody } from "./comment";
import type { Title } from "./types";
import { fullTime, relativeTime } from "@/lib/format";
import { conversationHref } from "@/lib/conversations/paths";
import type { ConversationComment, ConversationPreview } from "@/lib/conversations/types";
import { t } from "@/lib/messages";

// Conversation preview (DESIGN-SYSTEM.md 5.17), on title detail (PRD F6, DS 5.17): the group's
// name, its 3 most recent comments, "See all 12 comments", and "Add a
// comment…", which opens the conversation with the composer focused. Any
// title can have a conversation in any of your groups, so with more than one
// group a chip row switches between them (`?group=`). Spoilers are never
// previewed, even your own (DS 4.2.12).

export function PreviewComment({ comment, viewerId, now }: { comment: ConversationComment; viewerId: string; now?: Date }) {
  return (
    <li className="flex gap-3">
      <Avatar person={comment.author} size={32} decorative className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-body-strong text-default">{comment.author.name}</span>
          <time dateTime={comment.at.toISOString()} title={fullTime(comment.at)} className="text-caption text-muted">
            {relativeTime(comment.at, now)}
          </time>
          {comment.edited && <span className="text-caption text-muted">{t("comment.edited")}</span>}
        </p>
        {comment.spoiler ? (
          <p className="inline-flex items-center gap-1 text-body italic text-muted">
            <Icon name="spoiler" size={16} />
            {t("spoiler.preview")}
          </p>
        ) : (
          <div className="line-clamp-3">
            <CommentBody body={comment.body} viewerId={viewerId} />
          </div>
        )}
      </div>
    </li>
  );
}

export function ConversationPreviewSection({
  title,
  previews,
  selectedId,
  viewerId,
  pathname,
  headingLevel = 2,
  now,
}: {
  title: Title;
  /** One per group you're in, in chip order. */
  previews: ConversationPreview[];
  selectedId: string;
  viewerId: string;
  /** Title detail's path, for the chips' `?group=` links. */
  pathname: string;
  /** /styleguide renders it lower. */
  headingLevel?: 2 | 3 | 4;
  now?: Date;
}) {
  const Heading = `h${headingLevel}` as const;
  const headingId = useId();
  const current = previews.find((p) => p.group.id === selectedId);
  if (!current) return null;
  const href = conversationHref(title, current.group.id);

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      {previews.length > 1 && (
        <div className="-mx-4 overflow-x-auto px-4 scrollbar-none">
          <ul aria-label={t("conversation.groupsLabel")} className="flex gap-2 py-2">
            {previews.map((p) => (
              <li key={p.group.id}>
                <GroupChoiceChip group={p.group} href={`${pathname}?group=${p.group.id}`} selected={p.group.id === current.group.id} />
              </li>
            ))}
          </ul>
        </div>
      )}
      <Heading id={headingId} className="flex items-center gap-2 text-heading text-default">
        <Icon name="comment" size={20} />
        {t("conversation.previewHeading", { group: current.group.name })}
      </Heading>
      {current.count === 0 ? (
        <p className="text-body text-muted">{t("conversation.empty")}</p>
      ) : (
        <>
          <ol aria-label={t("comment.list")} className="flex flex-col gap-4">
            {current.recent.map((comment) => (
              <PreviewComment key={comment.id} comment={comment} viewerId={viewerId} now={now} />
            ))}
          </ol>
          <TextLink href={href} variant="standalone" className="self-start">
            {t("conversation.seeAll", { count: current.count })}
          </TextLink>
        </>
      )}
      <NextLink
        href={conversationHref(title, current.group.id, { compose: true })}
        className="flex min-h-target items-center rounded-pill border border-strong bg-surface-raised px-4 text-body text-muted transition duration-fast ease-standard hover:bg-surface-hover fc-edge"
      >
        {t("conversation.addComment")}
      </NextLink>
    </section>
  );
}

/** While the preview loads (DS 4.1.17). */
export function ConversationPreviewSkeleton() {
  return (
    <SkeletonRegion label={t("conversation.loading")} className="flex flex-col gap-4">
      <Skeleton className="h-5 w-1/2 rounded-control" />
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="size-8 rounded-pill" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-4 w-24 rounded-control" />
            <Skeleton className="h-4 w-3/4 rounded-control" />
          </div>
        </div>
      ))}
    </SkeletonRegion>
  );
}

/** The preview didn't load: an error in its own region, with Retry (DS 5.12, partial). */
export function ConversationPreviewError({ headingLevel = 2 }: { headingLevel?: 2 | 3 | 4 }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <ErrorState
      headingLevel={headingLevel}
      title={t("conversation.errorTitle")}
      body={t("conversation.errorBody")}
      className="md:mx-0 md:items-start md:text-start"
      action={
        <Button variant="secondary" loading={pending} onClick={() => startTransition(() => router.refresh())}>
          {t("common.retry")}
        </Button>
      }
    />
  );
}
