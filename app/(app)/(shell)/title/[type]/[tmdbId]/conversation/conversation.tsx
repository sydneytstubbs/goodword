"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Comment, CommentList, NewCommentsDivider, NewCommentsPill } from "@/components/domain/comment";
import { Composer, type ComposerSend } from "@/components/domain/composer";
import { Poster } from "@/components/domain/poster";
import type { CommentSegment, Person, Title } from "@/components/domain/types";
import type { GroupWithCount } from "@/components/domain/visibility-line";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { GroupDot } from "@/components/ui/chip";
import { ErrorState } from "@/components/ui/empty-state";
import { useToast } from "@/components/ui/toast";
import {
  deleteComment,
  editComment,
  fetchComment,
  fetchNewerComments,
  fetchOlderComments,
  markConversationRead,
  markSpoilerHintSeen,
  postComment,
  restoreComment,
  revealComment,
  type CommentWriteResult,
} from "@/lib/conversations/actions";
import type { ConversationComment, ConversationKey, ConversationPage } from "@/lib/conversations/types";
import { prefersReducedMotion } from "@/lib/hooks";
import { t } from "@/lib/messages";
import { useBroadcast } from "@/lib/supabase/realtime";
import { useActivityCount } from "../../../../activity-count";
import { OfflineBanner } from "../../../../offline-banner";

// A group's conversation about a title (PRD F13, DS 4.2.10–4.2.12, 5.17), or
// the conversation under a good word (F16.5), which works the same way.
// Oldest at the top; opens at the linked comment, the New divider, or the
// bottom. Older comments load in pages of 30 when scrolling up, keeping your
// place. New comments from others arrive live: at the bottom they scroll into
// view; scrolled up, a pill offers them instead. Your own comments appear at
// once (optimistic) and can be retried if they don't send. Other people's
// spoilers are fetched only when you reveal them.

type Status = "sent" | "sending" | "failed";
type Entry = { comment: ConversationComment; status: Status };

const GROUP_WINDOW = 5 * 60_000;
const ANNOUNCE_EVERY = 10_000;
const HIGHLIGHT_MS = 2000;
const REVEALED_KEY = "revealed-comments";

/** Where the conversation is: a group, or under a good word (PRD F16.5). */
export type ConversationPlace =
  | { kind: "group"; group: GroupWithCount; viewerIsOwner: boolean }
  | { kind: "word"; goodWordId: string; author: Person };

function byTime(a: Entry, b: Entry) {
  return a.comment.at.getTime() - b.comment.at.getTime();
}

function readRevealed(): Set<string> {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(REVEALED_KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

function rememberRevealed(id: string) {
  try {
    const ids = readRevealed();
    ids.add(id);
    sessionStorage.setItem(REVEALED_KEY, JSON.stringify([...ids]));
  } catch {
    // Private browsing: revealing just won't outlast this page.
  }
}

/** Keeps the screen above the iOS keyboard, and toasts above the composer (DS 8.2, 4.1.15). */
function useViewportInsets(root: React.RefObject<HTMLElement | null>, composer: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    const bar = composer.current;
    const viewport = window.visualViewport;
    if (!el || !bar) return;
    const desktop = window.matchMedia("(min-width: 64rem)");
    const update = () => {
      const inset = viewport && !desktop.matches ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      el.style.setProperty("--keyboard-inset", `${inset}px`);
      if (desktop.matches) document.documentElement.style.removeProperty("--toast-offset");
      else document.documentElement.style.setProperty("--toast-offset", `${bar.offsetHeight + inset}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(bar);
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    desktop.addEventListener("change", update);
    return () => {
      observer.disconnect();
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      desktop.removeEventListener("change", update);
      document.documentElement.style.removeProperty("--toast-offset");
    };
  }, [root, composer]);
}

export function Conversation({
  title,
  titleId,
  place,
  members,
  viewer,
  initial,
  linkedCommentId,
  compose,
  showSpoilerHint,
  backHref,
}: {
  title: Title;
  titleId: string;
  place: ConversationPlace;
  /** People who can be mentioned here. */
  members: Person[];
  viewer: Person;
  /** Null when the conversation didn't load: an error with Retry, and the composer still works. */
  initial: ConversationPage | null;
  linkedCommentId?: string;
  /** Arrived from "Add a comment…": the composer is focused. */
  compose: boolean;
  showSpoilerHint: boolean;
  /** Title detail, with this conversation selected. */
  backHref: string;
}) {
  const key: ConversationKey =
    place.kind === "group" ? { kind: "group", groupId: place.group.id, titleId } : { kind: "word", goodWordId: place.goodWordId, titleId };
  const keyId = place.kind === "group" ? `${place.group.id}:${titleId}` : place.goodWordId;
  // Group owners, and a good word's author, can delete others' comments (F13, F16.5).
  const canModerate = place.kind === "group" ? place.viewerIsOwner : place.author.id === viewer.id;
  const placeName =
    place.kind === "group"
      ? place.group.name
      : place.author.id === viewer.id
        ? t("conversation.yourWordHeading")
        : t("conversation.wordHeading", { name: place.author.name });
  const router = useRouter();
  const { showToast, announce } = useToast();
  const { refresh: refreshActivity } = useActivityCount();
  const [entries, setEntries] = useState<Entry[]>(() => (initial?.comments ?? []).map((comment) => ({ comment, status: "sent" })));
  const [hasOlder, setHasOlder] = useState(initial?.hasOlder ?? false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [revealed, setRevealed] = useState<Record<string, CommentSegment[]>>({});
  const [newBelow, setNewBelow] = useState(0);
  const [highlight, setHighlight] = useState<string | null>(linkedCommentId ?? null);
  const [hint, setHint] = useState(showSpoilerHint && title.type === "tv");
  const firstUnseenId = initial?.firstUnseenId;

  const rootRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastAnnounced = useRef(0);
  const pendingDeletes = useRef(new Map<string, Promise<CommentWriteResult>>());
  const keepScroll = useRef<number | null>(null);
  const subscribedOnce = useRef(false);
  const entriesRef = useRef(entries);
  useEffect(() => {
    entriesRef.current = entries;
  });

  useViewportInsets(rootRef, composerRef);

  const nearBottom = () => {
    const el = listRef.current;
    return !el || el.scrollHeight - el.scrollTop - el.clientHeight < 96;
  };
  const scrollToBottom = useCallback(() => {
    const el = listRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: prefersReducedMotion() ? "auto" : "smooth" });
    setNewBelow(0);
  }, []);

  // Opening: the linked comment, highlighted for 2 seconds; else the New
  // divider; else the bottom (DS 5.17).
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const target = linkedCommentId
      ? document.getElementById(`comment-${linkedCommentId}`)
      : firstUnseenId
        ? document.getElementById("new-comments")
        : null;
    if (target) target.scrollIntoView({ block: linkedCommentId ? "center" : "start" });
    else el.scrollTop = el.scrollHeight;
    if (linkedCommentId) {
      const timer = setTimeout(() => setHighlight(null), HIGHLIGHT_MS);
      return () => clearTimeout(timer);
    }
  }, [linkedCommentId, firstUnseenId]);

  // Seen up to the newest comment shown; its Activity items become read (F13, F14).
  const latestAt = entries.filter((e) => e.status === "sent").at(-1)?.comment.at.getTime() ?? null;
  useEffect(() => {
    if (latestAt === null) return;
    markConversationRead(key, new Date(latestAt).toISOString())
      .then(refreshActivity)
      .catch(() => {
        // Offline: it's marked next time.
      });
    // The key is rebuilt each render; keyId names the conversation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestAt, keyId, refreshActivity]);

  // Spoilers revealed earlier this session stay revealed (DS 4.2.12).
  useEffect(() => {
    const ids = readRevealed();
    for (const { comment } of entriesRef.current) {
      if (comment.covered && ids.has(comment.id)) {
        revealComment(comment.id)
          .then((body) => body && setRevealed((r) => ({ ...r, [comment.id]: body })))
          .catch(() => {});
      }
    }
  }, []);

  // Older pages keep your place: restore the distance from the bottom.
  useLayoutEffect(() => {
    const el = listRef.current;
    if (el && keepScroll.current !== null) {
      el.scrollTop = el.scrollHeight - keepScroll.current;
      keepScroll.current = null;
    }
  }, [entries]);

  const merge = useCallback(
    (incoming: ConversationComment[]) => {
      const known = new Set(entriesRef.current.map((e) => e.comment.id));
      const added = incoming.filter((c) => !known.has(c.id));
      if (added.length === 0) return;
      const atBottom = nearBottom();
      setEntries((current) => {
        const have = new Set(current.map((e) => e.comment.id));
        const fresh = added.filter((c) => !have.has(c.id)).map((comment) => ({ comment, status: "sent" as const }));
        return fresh.length === 0 ? current : [...current, ...fresh].sort(byTime);
      });
      const others = added.filter((c) => c.author.id !== viewer.id);
      if (others.length === 0) return;
      if (atBottom) requestAnimationFrame(scrollToBottom);
      else setNewBelow((n) => n + others.length);
      // "New comment from Priya", at most once every 10 seconds (DS 5.17).
      if (Date.now() - lastAnnounced.current > ANNOUNCE_EVERY) {
        lastAnnounced.current = Date.now();
        announce(t("conversation.newCommentFrom", { name: others.at(-1)!.author.name }));
      }
    },
    [announce, scrollToBottom, viewer.id],
  );

  // Live updates (F13): the message is only an id; the comment is fetched
  // with other people's spoiler text withheld.
  useBroadcast(
    place.kind === "group" ? `conversation:${place.group.id}:${titleId}` : `word:${place.goodWordId}`,
    "comment",
    (payload) => {
      const id = String(payload.id ?? "");
      const op = payload.op;
      const mine = entriesRef.current.find((e) => e.comment.id === id);
      if (op === "delete") {
        if (!pendingDeletes.current.has(id)) setEntries((current) => current.filter((e) => e.comment.id !== id));
        return;
      }
      if (op === "insert" && mine) return;
      fetchComment(id, key)
        .then((comment) => {
          if (!comment) {
            if (op === "update") setEntries((current) => current.filter((e) => e.comment.id !== id));
            return;
          }
          if (op === "insert") merge([comment]);
          else {
            setEntries((current) => current.map((e) => (e.comment.id === id ? { ...e, comment } : e)));
            setRevealed((r) => {
              if (!(id in r)) return r;
              const next = { ...r };
              delete next[id];
              return next;
            });
          }
        })
        .catch(() => {});
    },
    () => {
      // Reconnected: catch up on anything missed while the connection was down.
      if (!subscribedOnce.current) {
        subscribedOnce.current = true;
        return;
      }
      const last = entriesRef.current.filter((e) => e.status === "sent").at(-1)?.comment.at;
      if (!last) return;
      fetchNewerComments(key, last.toISOString())
        .then((comments) => comments && merge(comments))
        .catch(() => {});
    },
  );

  function setStatus(id: string, status: Status) {
    setEntries((current) => current.map((e) => (e.comment.id === id ? { ...e, status } : e)));
  }

  function writeFailed(result: CommentWriteResult, retry: () => void) {
    if (result.ok) return;
    if (result.error === "rateLimited") showToast({ message: t("conversation.rateLimited") });
    else showToast({ message: t("conversation.didntSave"), action: { label: t("common.retry"), onAction: retry } });
  }

  function send(id: string, body: CommentSegment[], spoiler: boolean) {
    setStatus(id, "sending");
    postComment({ id, conversation: key, body, spoiler })
      .catch((): CommentWriteResult => ({ ok: false, error: "failed" }))
      .then((result) => {
        setStatus(id, result.ok ? "sent" : "failed");
        if (!result.ok && result.error === "rateLimited") showToast({ message: t("conversation.rateLimited") });
      });
  }

  function onSend({ body, spoiler }: ComposerSend) {
    const id = crypto.randomUUID();
    const comment: ConversationComment = { id, author: viewer, body, at: new Date(), covered: false, ...(spoiler ? { spoiler } : {}) };
    setEntries((current) => [...current, { comment, status: "sending" }]);
    requestAnimationFrame(scrollToBottom);
    send(id, body, spoiler);
    if (hint) {
      setHint(false);
      markSpoilerHintSeen().catch(() => {});
    }
  }

  function onSave(entry: Entry, body: CommentSegment[], spoiler: boolean) {
    const before = entry.comment;
    const attempt = () => {
      setEntries((current) =>
        current.map((e) => (e.comment.id === before.id ? { ...e, comment: { ...before, body, edited: true, spoiler } } : e)),
      );
      editComment(before.id, body, spoiler)
        .catch((): CommentWriteResult => ({ ok: false, error: "failed" }))
        .then((result) => {
          if (result.ok) return;
          setEntries((current) => current.map((e) => (e.comment.id === before.id ? { ...e, comment: before } : e)));
          writeFailed(result, attempt);
        });
    };
    attempt();
  }

  function onDelete(entry: Entry) {
    const id = entry.comment.id;
    // A comment that never sent is just discarded.
    if (entry.status === "failed") {
      setEntries((current) => current.filter((e) => e.comment.id !== id));
      return;
    }
    const putBack = () => setEntries((current) => (current.some((e) => e.comment.id === id) ? current : [...current, entry].sort(byTime)));
    setEntries((current) => current.filter((e) => e.comment.id !== id));
    const deleting = deleteComment(id).catch((): CommentWriteResult => ({ ok: false, error: "failed" }));
    pendingDeletes.current.set(id, deleting);
    // Immediate, with an 8-second Undo (DS 4.2.10, 5.11).
    showToast({
      message: t("comment.deleted"),
      action: {
        label: t("common.undo"),
        onAction: () => {
          putBack();
          deleting
            .then((result) => (result.ok ? restoreComment(id) : result))
            .catch((): CommentWriteResult => ({ ok: false, error: "failed" }))
            .then((result) => {
              if (result.ok) return;
              setEntries((current) => current.filter((e) => e.comment.id !== id));
              showToast({ message: t("conversation.didntSave") });
            });
        },
      },
    });
    deleting.then((result) => {
      setTimeout(() => pendingDeletes.current.delete(id), 10_000);
      if (result.ok) return;
      putBack();
      writeFailed(result, () => onDelete(entry));
    });
  }

  function onReveal(id: string) {
    revealComment(id)
      .catch(() => null)
      .then((body) => {
        if (!body) {
          showToast({ message: t("conversation.revealFailed") });
          return;
        }
        rememberRevealed(id);
        setRevealed((r) => ({ ...r, [id]: body }));
      });
  }

  async function loadOlder() {
    const first = entries.find((e) => e.status === "sent")?.comment;
    if (!first || loadingOlder) return;
    setLoadingOlder(true);
    const result = await fetchOlderComments(key, first.at.toISOString()).catch(() => null);
    setLoadingOlder(false);
    if (!result) {
      showToast({ message: t("conversation.olderFailed") });
      return;
    }
    const el = listRef.current;
    if (el) keepScroll.current = el.scrollHeight - el.scrollTop;
    setEntries((current) => {
      const known = new Set(current.map((e) => e.comment.id));
      return [...result.comments.filter((c) => !known.has(c.id)).map((comment) => ({ comment, status: "sent" as const })), ...current];
    });
    setHasOlder(result.hasOlder);
  }

  // Older comments load when scrolling near the top; the button is the fallback.
  const topRef = useRef<HTMLDivElement>(null);
  const loadOlderRef = useRef(loadOlder);
  useEffect(() => {
    loadOlderRef.current = loadOlder;
  });
  useEffect(() => {
    const el = topRef.current;
    if (!el || !hasOlder) return;
    const observer = new IntersectionObserver((seen) => seen.some((s) => s.isIntersecting) && void loadOlderRef.current(), {
      root: listRef.current,
      rootMargin: "200px 0px 0px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasOlder]);

  function back(e: React.MouseEvent) {
    // Back returns to wherever you came from (PRD 6.2); from an email link, to title detail.
    if (window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  }

  let body: ReactNode;
  if (!initial) {
    body = (
      <ErrorState
        headingLevel={2}
        title={t("conversation.errorTitle")}
        body={t("conversation.errorBody")}
        action={
          <Button variant="secondary" onClick={() => router.refresh()}>
            {t("common.retry")}
          </Button>
        }
      />
    );
  } else if (entries.length === 0) {
    body = (
      // Tapping the empty state focuses the composer (DS 5.17).
      <button
        type="button"
        onClick={() => inputRef.current?.focus()}
        className="m-auto max-w-reading rounded-card px-4 py-8 text-center text-body text-muted"
      >
        {t("conversation.empty")}
      </button>
    );
  } else {
    body = (
      <CommentList>
        {entries.map((entry, i) => {
          const previous = entries[i - 1];
          const dividerHere = entry.comment.id === firstUnseenId;
          const grouped =
            !dividerHere &&
            previous !== undefined &&
            previous.comment.author.id === entry.comment.author.id &&
            entry.comment.at.getTime() - previous.comment.at.getTime() < GROUP_WINDOW;
          return (
            <li key={entry.comment.id} className="flex flex-col gap-4">
              {dividerHere && (
                <div id="new-comments" className="scroll-mt-4">
                  <NewCommentsDivider />
                </div>
              )}
              <Comment
                comment={entry.comment}
                viewerId={viewer.id}
                viewerIsOwner={canModerate}
                members={members}
                status={entry.status}
                grouped={grouped}
                highlighted={highlight === entry.comment.id}
                {...(entry.comment.covered
                  ? { revealedBody: revealed[entry.comment.id], onReveal: () => onReveal(entry.comment.id) }
                  : {})}
                onSave={(segments, spoiler) => onSave(entry, segments, spoiler)}
                onDelete={() => onDelete(entry)}
                onRetry={() => send(entry.comment.id, entry.comment.body, entry.comment.spoiler ?? false)}
              />
            </li>
          );
        })}
      </CommentList>
    );
  }

  return (
    <section
      ref={rootRef}
      aria-labelledby="conversation-title"
      className="fixed inset-0 z-nav mb-keyboard flex flex-col bg-surface lg:sticky lg:inset-auto lg:top-0 lg:z-auto lg:mb-0 lg:h-dvh lg:w-96 lg:shrink-0 lg:border-s lg:border-subtle xl:w-120"
    >
      <header className="flex shrink-0 items-center gap-3 border-b border-subtle ps-1 pe-4 pt-safe pb-2 lg:ps-4 lg:pt-4">
        <a
          href={backHref}
          onClick={back}
          aria-label={t("conversation.back", { title: title.name })}
          className="group relative grid size-target shrink-0 place-items-center rounded-control text-default lg:hidden"
        >
          <span
            aria-hidden="true"
            className="absolute inset-1 rounded-control transition duration-fast ease-standard group-hover:bg-surface-hover group-active:bg-surface-pressed"
          />
          <Icon name="back" size={24} className="relative" />
        </a>
        <Poster title={title} size="row" className="mt-2 lg:hidden" />
        <div className="flex min-w-0 flex-col gap-1 pt-2">
          <h1 id="conversation-title" className="line-clamp-2 text-heading text-default">
            <span className="lg:hidden">{title.name}</span>
            <span className="hidden lg:inline">
              {place.kind === "group" ? t("conversation.previewHeading", { group: place.group.name }) : placeName}
            </span>
          </h1>
          <p className="inline-flex items-center gap-2 text-caption text-muted lg:hidden">
            {place.kind === "group" ? (
              <>
                <GroupDot group={place.group} />
                {t("conversation.inGroup", { group: place.group.name })}
              </>
            ) : (
              <>
                <Icon name="friends" size={16} className="shrink-0" />
                {placeName}
              </>
            )}
          </p>
        </div>
      </header>
      <div className="pt-2 empty:hidden">
        <OfflineBanner />
      </div>
      <div ref={listRef} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-4 py-4" onScroll={() => nearBottom() && newBelow > 0 && setNewBelow(0)}>
        {hasOlder && (
          <div ref={topRef} className="flex justify-center pb-4">
            <Button variant="ghost" size="sm" loading={loadingOlder} onClick={() => void loadOlder()}>
              {t("conversation.loadOlder")}
            </Button>
          </div>
        )}
        {body}
      </div>
      <div ref={composerRef} className="relative shrink-0">
        {newBelow > 0 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-full flex justify-center pb-3">
            <NewCommentsPill count={newBelow} onJump={scrollToBottom} />
          </div>
        )}
        <Composer
          {...(place.kind === "group"
            ? { group: place.group }
            : { word: { authorName: place.author.name, mine: place.author.id === viewer.id } })}
          members={members}
          viewerId={viewer.id}
          draftKey={place.kind === "group" ? `${titleId}:${place.group.id}` : `word:${place.goodWordId}`}
          autoFocus={compose}
          inputRef={inputRef}
          hint={hint ? <p className="text-caption text-muted">{t("conversation.spoilerHint")}</p> : undefined}
          onSend={onSend}
        />
      </div>
    </section>
  );
}
