"use client";

import NextLink from "next/link";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { fullTime, relativeTime, relativeTimeLong } from "@/lib/format";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { Menu } from "../ui/menu";
import { Skeleton, SkeletonRegion } from "../ui/skeleton";
import { Textarea } from "../ui/textarea";
import { SpoilerCover, SpoilerToggle } from "./spoiler-cover";
import type { CommentData, CommentSegment, Person } from "./types";

// Comment (DESIGN-SYSTEM.md 4.2.10): one message in a title's conversation
// within a group. Flat, no nested replies, no reactions, no read receipts.

export type CommentStatus = "sent" | "sending" | "failed";

export function CommentBody({ body, viewerId }: { body: CommentSegment[]; viewerId?: string }) {
  return (
    // Line breaks are kept; long unbroken strings wrap (PRD F13).
    <p className="max-w-reading whitespace-pre-wrap text-body text-default wrap-anywhere">
      {body.map((segment, i) =>
        segment.kind === "text" ? (
          <span key={i}>{segment.text}</span>
        ) : segment.userId === viewerId ? (
          <strong key={i} className="rounded-control bg-action-wash px-1 font-semibold text-action-text fc-selected">
            @{segment.name}
          </strong>
        ) : (
          <strong key={i} className="font-semibold">
            @{segment.name}
          </strong>
        ),
      )}
    </p>
  );
}

/** Plain text for editing. Mentions become "@Name". */
function toText(body: CommentSegment[]): string {
  return body.map((s) => (s.kind === "text" ? s.text : `@${s.name}`)).join("");
}

/** Re-parse "@Name" for members of this group only (DS 4.2.11). */
export function parseBody(text: string, members: Person[]): CommentSegment[] {
  const names = [...members].sort((a, b) => b.name.length - a.name.length);
  const segments: CommentSegment[] = [];
  let buffer = "";
  let i = 0;
  while (i < text.length) {
    const match = text[i] === "@" ? names.find((m) => text.startsWith(`@${m.name}`, i)) : undefined;
    if (match) {
      if (buffer) segments.push({ kind: "text", text: buffer });
      buffer = "";
      segments.push({ kind: "mention", userId: match.id, name: match.name });
      i += match.name.length + 1;
    } else {
      buffer += text[i];
      i += 1;
    }
  }
  if (buffer) segments.push({ kind: "text", text: buffer });
  return segments;
}

export function Comment({
  comment,
  viewerId,
  viewerIsOwner = false,
  members,
  status = "sent",
  grouped = false,
  now,
  highlighted = false,
  revealedBody,
  onReveal,
  onSave,
  onDelete,
  onRetry,
}: {
  comment: CommentData;
  viewerId: string;
  /** Group owners can delete anyone's comment. */
  viewerIsOwner?: boolean;
  /** Members of this group, for re-parsing mentions after an edit. */
  members: Person[];
  status?: CommentStatus;
  /** A burst from the same person within 5 minutes collapses the avatar and name. */
  grouped?: boolean;
  now?: Date;
  /** Arrived at from a link: a brief wash (DS 5.17). */
  highlighted?: boolean;
  /**
   * Someone else's spoiler whose text isn't in the page (DS 4.2.12): the text
   * once it's been fetched. With `onReveal`, the cover asks for it.
   */
  revealedBody?: CommentSegment[];
  onReveal?: () => void;
  onSave: (body: CommentSegment[], spoiler: boolean) => void;
  onDelete: () => void;
  onRetry?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [draftSpoiler, setDraftSpoiler] = useState(false);
  const isAuthor = comment.author.id === viewerId;
  const mentionsYou = comment.body.some((s) => s.kind === "mention" && s.userId === viewerId);
  const time = relativeTime(comment.at, now);

  const actions = [
    ...(isAuthor
      ? [
          {
            label: t("common.edit"),
            icon: "edit" as const,
            onSelect: () => {
              setDraft(toText(comment.body));
              setDraftSpoiler(comment.spoiler ?? false);
              setEditing(true);
            },
          },
        ]
      : []),
    ...(isAuthor || viewerIsOwner
      ? [{ label: t("common.delete"), icon: "remove" as const, onSelect: onDelete, destructive: true }]
      : []),
  ];

  let body: ReactNode;
  if (editing) {
    body = (
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim().length === 0) return;
          onSave(
            parseBody(
              draft,
              members.filter((m) => m.id !== viewerId),
            ),
            draftSpoiler,
          );
          setEditing(false);
        }}
      >
        <Textarea
          label={t("comment.editLabel")}
          hideLabel
          value={draft}
          onValueChange={setDraft}
          maxLength={500}
          counterAt={400}
          minRows={2}
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-3">
          <SpoilerToggle on={draftSpoiler} onToggle={() => setDraftSpoiler((on) => !on)} />
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="secondary" size="sm">
            {t("common.save")}
          </Button>
        </div>
      </form>
    );
  } else if (comment.spoiler && !isAuthor) {
    const shown = onReveal ? revealedBody : comment.body;
    body = (
      <SpoilerCover
        authorName={comment.author.name}
        {...(onReveal ? { revealed: revealedBody !== undefined, onReveal } : {})}
      >
        {() => <CommentBody body={shown ?? []} viewerId={viewerId} />}
      </SpoilerCover>
    );
  } else {
    body = <CommentBody body={comment.body} viewerId={viewerId} />;
  }

  return (
    <article
      id={`comment-${comment.id}`}
      aria-label={t("comment.accessibleName", { name: comment.author.name, time: relativeTimeLong(comment.at, now) })}
      className={cn(
        "relative flex scroll-mt-24 gap-3 rounded-control motion-ok:transition-colors motion-ok:duration-slow",
        mentionsYou && "-ms-3 border-s-2 border-action ps-2.5",
        highlighted && "bg-action-wash",
      )}
    >
      {mentionsYou && <span className="sr-only">{t("comment.mentionsYou")}</span>}
      {grouped ? (
        <span aria-hidden="true" className="w-8 shrink-0" />
      ) : (
        <Avatar person={comment.author} size={32} decorative className="mt-0.5" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {!grouped && (
          <div className="flex flex-wrap items-baseline gap-x-2">
            {isAuthor ? (
              <span className="text-body-strong text-default">{comment.author.name}</span>
            ) : (
              // Their good words in groups you share (PRD F8). Padding makes the
              // 44px target; the negative margin keeps the header row's height.
              <NextLink
                href={`/people/${comment.author.id}`}
                className="-my-2.5 inline-flex min-h-target items-center rounded-control text-body-strong text-default underline-offset-4 hover:underline"
              >
                {comment.author.name}
              </NextLink>
            )}
            <time dateTime={comment.at.toISOString()} title={fullTime(comment.at)} className="text-caption text-muted">
              {time}
            </time>
            {comment.edited && <span className="text-caption text-muted">{t("comment.edited")}</span>}
          </div>
        )}
        <div className={cn(status === "sending" && "opacity-60")}>{body}</div>
        {comment.spoiler && isAuthor && !editing && (
          <p className="inline-flex items-center gap-1 text-caption text-muted">
            <Icon name="spoiler" size={16} />
            {t("comment.markedSpoiler")}
          </p>
        )}
        {status === "sending" && <p className="text-caption text-muted">{t("comment.sending")}</p>}
        {status === "failed" && (
          <div className="flex flex-wrap items-center gap-x-3 text-caption text-danger">
            <span className="inline-flex items-center gap-1">
              <Icon name="error" size={16} />
              {t("comment.failed")}
            </span>
            <Button variant="ghost" size="sm" onClick={onRetry}>
              {t("common.retry")}
            </Button>
            <Button variant="danger" size="sm" onClick={onDelete}>
              {t("common.delete")}
            </Button>
          </div>
        )}
      </div>
      {actions.length > 0 && status === "sent" && !editing && (
        <Menu
          label={t("comment.moreActionsFor", { name: comment.author.name })}
          items={actions}
          trigger={(props) => (
            <IconButton
              icon="more"
              tone="muted"
              label={t("comment.moreActionsFor", { name: comment.author.name })}
              className="-me-3 -mt-2"
              {...props}
            />
          )}
        />
      )}
    </article>
  );
}

/** The "New" divider before the first unseen comment. */
export function NewCommentsDivider() {
  return (
    <div role="separator" aria-label={t("common.new")} className="flex items-center gap-3 text-caption font-semibold text-action-text">
      <span aria-hidden="true" className="h-px flex-1 bg-action" />
      <span aria-hidden="true">{t("common.new")}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-action" />
    </div>
  );
}

/** Comments are an ordered list of articles, separated by --space-4. */
export function CommentList({ children }: { children: ReactNode }) {
  return (
    <ol aria-label={t("comment.list")} className="flex flex-col gap-4">
      {children}
    </ol>
  );
}

/** "2 new comments": live comments arrived while you were scrolled up (DS 5.17). Jumps to them. */
export function NewCommentsPill({ count, onJump }: { count: number; onJump: () => void }) {
  return (
    <button
      type="button"
      onClick={onJump}
      className="pointer-events-auto inline-flex min-h-target items-center gap-1 rounded-pill bg-inverse px-4 text-label font-semibold text-inverse shadow-md fc-edge"
    >
      {t("conversation.newComments", { count })}
    </button>
  );
}

/** Four skeleton comments while a conversation loads (DS 5.17, 4.1.17). */
export function CommentSkeletons() {
  return (
    <SkeletonRegion label={t("conversation.loading")} className="flex flex-col gap-6">
      {[0, 1, 2, 3].map((i) => (
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
