"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Icon } from "@/components/icon";
import { NoteField } from "@/components/domain/confirm-good-word";
import { Poster } from "@/components/domain/poster";
import { TitleSearch } from "@/components/domain/title-search";
import { titleMeta } from "@/components/domain/title-meta";
import type { Title } from "@/components/domain/types";
import { VisibilityLine, type GroupWithCount } from "@/components/domain/visibility-line";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { IconButton } from "@/components/ui/icon-button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { prefersReducedMotion } from "@/lib/hooks";
import { addAllRemaining, addImportCard, skipImportCard, undoImportCard, type DeckResult } from "@/lib/import/actions";
import { candidateTitle, type CardCandidate } from "@/lib/import/match";
import { normalizeTitle } from "@/lib/import/text";
import { t } from "@/lib/messages";
import { useGoodWords } from "../../../good-words";

// The review deck (PRD F15.3, DS 5.18): one card at a time, nothing added
// until it's confirmed. Add, Edit, and Skip are buttons (bottom bar on
// phones, inline on desktop with A, E, S, and ← shortcuts); swiping the card
// is a shortcut for Add and Skip, never the only way. Every action shows a
// toast with Undo, Back revisits the previous card, and the card shown is in
// the URL (?card=). Writes are optimistic and roll back with Retry (DS 5.10).

export type DeckCard = {
  id: string;
  position: number;
  query: string;
  note: string;
  confidence: "high" | "low";
  candidates: CardCandidate[];
  chosen: number;
  decision: "pending" | "added" | "skipped";
};

type Draft = { chosen: number; note: string; noteOpen: boolean; editing: boolean; searching: boolean; searched: Title | null; opened: boolean };

const SWIPE_PX = 96;
const SEQUENCE_MS = 1500;

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

function draftFor(card: DeckCard): Draft {
  const low = card.confidence === "low";
  return { chosen: card.chosen, note: card.note, noteOpen: card.note.length > 0, editing: low, searching: false, searched: null, opened: low };
}

/** Keeps the action bar above the iOS keyboard, and toasts above the bar (DS 8.2, 4.1.15). */
function useBarInsets(root: React.RefObject<HTMLElement | null>, bar: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = root.current;
    const barEl = bar.current;
    const viewport = window.visualViewport;
    if (!el || !barEl) return;
    const desktop = window.matchMedia("(min-width: 64rem)");
    const update = () => {
      const inset = viewport && !desktop.matches ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      el.style.setProperty("--keyboard-inset", `${inset}px`);
      if (desktop.matches) document.documentElement.style.removeProperty("--toast-offset");
      else document.documentElement.style.setProperty("--toast-offset", `${barEl.offsetHeight + inset}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(barEl);
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
  }, [root, bar]);
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd aria-hidden="true" className="hidden rounded-checkbox border border-current px-1 font-sans text-caption lg:inline">
      {children}
    </kbd>
  );
}

export function ReviewDeck({
  importId,
  cards: initialCards,
  duplicates,
  startAt,
  truncated,
  groups,
  peopleCount,
}: {
  importId: string;
  cards: DeckCard[];
  duplicates: number;
  /** ?card= from the URL: a position to resume at. */
  startAt: number | null;
  truncated: boolean;
  groups: GroupWithCount[];
  peopleCount: number;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const { showMilestone } = useGoodWords();
  const [cards, setCards] = useState(initialCards);
  const firstPending = initialCards.findIndex((c) => c.decision === "pending");
  const fromUrl = startAt ? initialCards.findIndex((c) => c.position === startAt) : -1;
  const [index, setIndex] = useState(fromUrl >= 0 ? fromUrl : firstPending);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [bulkBusy, setBulkBusy] = useState(false);
  const [showTruncated, setShowTruncated] = useState(truncated);
  const rootRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const altsId = useId();
  useBarInsets(rootRef, barRef);

  const done = index < 0 || index >= cards.length;
  const card = done ? null : cards[index];
  const draft = card ? (drafts[card.id] ?? draftFor(card)) : null;
  const pending = cards.filter((c) => c.decision === "pending");
  const highLeft = pending.filter((c) => c.confidence === "high").length;

  const setDraft = (id: string, patch: Partial<Draft>) =>
    setDrafts((all) => ({ ...all, [id]: { ...(all[id] ?? draftFor(cards.find((c) => c.id === id)!)), ...patch } }));

  // The card shown lives in the URL, so a reload or a shared link resumes there (DS 5.1).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (card) url.searchParams.set("card", String(card.position));
    else url.searchParams.delete("card");
    url.searchParams.delete("more");
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [card]);

  // Focus moves to the new card's title so screen readers hear it.
  const moved = useRef(false);
  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
    moved.current = true;
  }, [index]);

  /** The next card still to decide after `from`, wrapping to earlier ones; -1 when none. */
  const nextPending = useCallback(
    (list: DeckCard[], from: number) => {
      for (let i = from + 1; i < list.length; i++) if (list[i].decision === "pending") return i;
      for (let i = 0; i <= from && i < list.length; i++) if (list[i].decision === "pending") return i;
      return -1;
    },
    [],
  );

  const setDecision = (id: string, decision: DeckCard["decision"], chosen?: number, note?: string) =>
    setCards((list) => list.map((c) => (c.id === id ? { ...c, decision, ...(chosen !== undefined ? { chosen } : {}), ...(note !== undefined ? { note } : {}) } : c)));

  const failMessage = (result: DeckResult) =>
    !navigator.onLine
      ? t("importDeck.offline")
      : !result.ok && result.error === "rateLimited"
        ? t("importDeck.rateLimited")
        : t("importDeck.didntSave");

  const undo = useCallback(
    async (target: DeckCard, at: number) => {
      const previous = target.decision;
      setDecision(target.id, "pending");
      setIndex(at);
      const result = await undoImportCard(target.id).catch((): DeckResult => ({ ok: false, error: "failed" }));
      if (!result.ok) {
        setDecision(target.id, previous);
        showToast({ message: failMessage(result) });
      }
    },
    [showToast],
  );

  async function decide(kind: "added" | "skipped") {
    if (!card || !draft) return;
    const at = index;
    const target = card;
    const searched = draft.searched;
    const chosen = draft.chosen;
    const note = draft.note.trim();
    const previous = target.decision;
    // Deciding again on a card you came back to: undo the old decision first.
    if (previous !== "pending") {
      const back = await undoImportCard(target.id).catch((): DeckResult => ({ ok: false, error: "failed" }));
      if (!back.ok) {
        showToast({ message: failMessage(back) });
        return;
      }
    }
    const updated = cards.map((c) => (c.id === target.id ? { ...c, decision: kind, chosen, note } : c));
    setCards(updated);
    setIndex(nextPending(updated, at));
    const run = () =>
      kind === "added"
        ? addImportCard(target.id, {
            chosen,
            note,
            opened: draft.opened,
            ...(searched?.tmdbId ? { searched: { type: searched.type, tmdbId: searched.tmdbId } } : {}),
          })
        : skipImportCard(target.id, { chosen, note, opened: draft.opened });
    const result = await run().catch((): DeckResult => ({ ok: false, error: "failed" }));
    if (!result.ok) {
      // Roll back to the card, and offer Retry (DS 5.10).
      setDecision(target.id, "pending");
      setIndex(at);
      showToast({ message: failMessage(result), action: { label: t("common.retry"), onAction: () => void decide(kind) } });
      return;
    }
    if (result.milestone) showMilestone(result.milestone);
    showToast({
      message: kind === "added" ? (result.created ? t("importDeck.added") : t("importDeck.alreadyAdded")) : t("importDeck.skipped"),
      action: { label: t("common.undo"), onAction: () => void undo({ ...target, decision: kind }, at) },
    });
  }

  async function addAll() {
    if (bulkBusy || highLeft === 0) return;
    setBulkBusy(true);
    const result = await addAllRemaining(importId).catch(() => ({ ok: false, added: 0, left: -1, rateLimited: false }));
    setBulkBusy(false);
    router.refresh();
    const ids = new Set(pending.filter((c) => c.confidence === "high").map((c) => c.id));
    if (result.ok) {
      const updated = cards.map((c) => (ids.has(c.id) ? { ...c, decision: "added" as const } : c));
      setCards(updated);
      setIndex(nextPending(updated, index));
      showToast({ message: t("importDeck.added") });
    } else {
      showToast({ message: result.rateLimited ? t("importDeck.rateLimited") : t("importDeck.didntSave") });
    }
  }

  function back() {
    if (index > 0) setIndex(index - 1);
    else if (done && cards.length > 0) setIndex(cards.length - 1);
  }

  function toggleEdit() {
    if (!card || !draft) return;
    setDraft(card.id, { editing: !draft.editing, searching: false, opened: true });
  }

  // Desktop shortcuts (PRD F15.3): A, E, S, ←. Never while typing, with a
  // sheet or menu open, or as the second key of a `g` sequence.
  const keys = useRef({ decide, toggleEdit, back });
  keys.current = { decide, toggleEdit, back };
  useEffect(() => {
    let lastG = 0;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector("dialog[open], [role='menu']")) return;
      const afterG = Date.now() - lastG < SEQUENCE_MS;
      lastG = e.key === "g" ? Date.now() : 0;
      if (afterG) return;
      const k = e.key.toLowerCase();
      if (k === "a") keys.current.decide("added");
      else if (k === "s") keys.current.decide("skipped");
      else if (k === "e") keys.current.toggleEdit();
      else if (e.key === "ArrowLeft") keys.current.back();
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // Swipe: right adds, left skips, past 96px. The card follows the finger
  // unless motion is reduced; the buttons do the same thing (WCAG 2.5.7).
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  function onPointerDown(e: React.PointerEvent) {
    if (e.pointerType === "mouse" || isTyping(e.target) || (e.target as HTMLElement).closest("button, a, input, textarea")) return;
    swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  }
  function onPointerMove(e: React.PointerEvent) {
    const s = swipe.current;
    if (!s || s.id !== e.pointerId || !cardRef.current || prefersReducedMotion()) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
    cardRef.current.style.transform = `translateX(${dx}px)`;
  }
  function onPointerEnd(e: React.PointerEvent) {
    const s = swipe.current;
    swipe.current = null;
    if (cardRef.current) cardRef.current.style.transform = "";
    if (!s || s.id !== e.pointerId) return;
    const dx = e.clientX - s.x;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - s.y)) return;
    void decide(dx > 0 ? "added" : "skipped");
  }

  const search = useCallback(async (query: string, signal: AbortSignal): Promise<Title[]> => {
    const res = await fetch(`/api/titles/search?q=${encodeURIComponent(query)}`, { signal });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    return ((await res.json()) as { results: Title[] }).results;
  }, []);

  const added = cards.filter((c) => c.decision === "added").length;

  return (
    <div ref={rootRef} className="flex min-h-dvh flex-col lg:min-h-0">
      <header className="sticky top-0 z-nav flex h-topbar items-center justify-between gap-2 bg-surface ps-1 pe-2 pt-safe lg:static lg:mx-auto lg:w-full lg:max-w-content lg:px-4">
        <Button variant="ghost" icon="back" onClick={back} aria-disabled={index === 0 && !done} aria-keyshortcuts="ArrowLeft">
          {t("importDeck.back")}
          <Kbd>{t("importDeck.keyBack")}</Kbd>
        </Button>
        {!done && (
          <p className="text-label font-medium text-muted" aria-live="polite">
            {t("importDeck.progress", { current: index + 1, total: cards.length })}
          </p>
        )}
        <IconButton icon="close" label={t("importDeck.close")} onClick={() => router.push("/you")} tooltipAlign="end" />
      </header>

      {done ? (
        <main className="mx-auto flex w-full max-w-reading flex-col items-start gap-4 px-4 py-8">
          <h1 ref={headingRef} tabIndex={-1} className="text-title-l text-default">
            {t("importDeck.doneTitle")}
          </h1>
          <p className="text-body text-default">
            {added > 0 ? t("importDeck.doneAdded", { count: added }) : t("importDeck.doneNone")}
            {duplicates > 0 && ` ${t("importDeck.doneDuplicates", { count: duplicates })}`}
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <ButtonLink href="/you" variant="primary" size="lg">
              {t("importDeck.viewMyList")}
            </ButtonLink>
            <ButtonLink href="/you/import" variant="secondary" size="lg">
              {t("importDeck.addMore")}
            </ButtonLink>
          </div>
        </main>
      ) : (
        card &&
        draft && (
          <main className="mx-auto flex w-full max-w-content flex-1 flex-col gap-6 px-4 pt-2 pb-8">
            {showTruncated && (
              <Banner onDismiss={() => setShowTruncated(false)}>{t("importRecs.truncated")}</Banner>
            )}
            <VisibilityLine groups={groups} peopleCount={peopleCount} compact />

            <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start lg:gap-10">
              <DeckCardView
                card={card}
                draft={draft}
                cardRef={cardRef}
                headingRef={headingRef}
                onNoteOpen={() => setDraft(card.id, { noteOpen: true })}
                onNoteChange={(note) => setDraft(card.id, { note })}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerEnd={onPointerEnd}
              />

              {draft.editing && (
                <section aria-labelledby={altsId} className="flex flex-col gap-3">
                  <h2 id={altsId} className="text-title-m text-default">
                    {draft.searching ? t("importDeck.searchHeading") : t("importDeck.alternatives")}
                  </h2>
                  {card.confidence === "low" && !draft.searching && <p className="text-body text-muted">{t("importDeck.notSure")}</p>}
                  {draft.searching ? (
                    <>
                      <TitleSearch
                        search={search}
                        autoFocus
                        onSelect={(title) => setDraft(card.id, { searched: title, searching: false })}
                        onClose={() => setDraft(card.id, { searching: false })}
                      />
                      <Button variant="ghost" className="self-start" onClick={() => setDraft(card.id, { searching: false })}>
                        {t("importDeck.hideSearch")}
                      </Button>
                    </>
                  ) : (
                    <>
                      <fieldset className="flex flex-col">
                        <legend className="sr-only">{t("importDeck.alternatives")}</legend>
                        {card.candidates.map((candidate, i) => {
                          const title = candidateTitle(candidate);
                          const checked = !draft.searched && draft.chosen === i;
                          return (
                            <label
                              key={title.id}
                              className={cn(
                                "flex min-h-target cursor-pointer items-center gap-3 rounded-control px-2 py-2 transition duration-fast ease-standard hover:bg-surface-hover",
                                checked && "bg-surface-sunken",
                              )}
                            >
                              <input
                                type="radio"
                                name={`alt-${card.id}`}
                                checked={checked}
                                onChange={() => setDraft(card.id, { chosen: i, searched: null })}
                                className="size-5 shrink-0 accent-action"
                              />
                              <Poster title={title} size="row" />
                              <span className="flex min-w-0 flex-col">
                                <span className="line-clamp-2 text-body text-default">{title.name}</span>
                                <span className="text-caption text-muted">{titleMeta(title)}</span>
                              </span>
                            </label>
                          );
                        })}
                      </fieldset>
                      <Button icon="search" className="self-start" onClick={() => setDraft(card.id, { searching: true })}>
                        {t("importDeck.searchInstead")}
                      </Button>
                    </>
                  )}
                </section>
              )}
            </div>
            <p className="text-caption text-muted lg:hidden">{t("importDeck.swipeHint")}</p>
            <p className="hidden text-caption text-muted lg:block">{t("importDeck.shortcutsHint")}</p>
          </main>
        )
      )}

      <div
        ref={barRef}
        className={cn(
          "fixed inset-x-0 bottom-0 z-nav mb-keyboard border-t border-subtle bg-surface px-4 pt-3 pb-safe-footer lg:static lg:mx-auto lg:w-full lg:max-w-content lg:border-0 lg:pb-12",
          done && "hidden",
        )}
      >
        {highLeft > 1 && (
          <Button variant="ghost" loading={bulkBusy} onClick={addAll} className="-ms-4 mb-2">
            {t("importDeck.addAll", { count: highLeft })}
          </Button>
        )}
        <div className="flex gap-3">
          <Button size="lg" onClick={() => void decide("skipped")} aria-keyshortcuts="S" className="flex-1 lg:flex-none">
            {t("importDeck.skip")}
            <Kbd>{t("importDeck.keySkip")}</Kbd>
          </Button>
          <Button
            size="lg"
            icon="edit"
            onClick={toggleEdit}
            aria-expanded={draft?.editing ?? false}
            aria-controls={draft?.editing ? altsId : undefined}
            aria-keyshortcuts="E"
            className="flex-1 lg:flex-none"
          >
            {t("importDeck.edit")}
            <Kbd>{t("importDeck.keyEdit")}</Kbd>
          </Button>
          <Button variant="primary" size="lg" icon="add" onClick={() => void decide("added")} aria-keyshortcuts="A" className="flex-1 lg:flex-none">
            {t("importDeck.add")}
            <Kbd>{t("importDeck.keyAdd")}</Kbd>
          </Button>
        </div>
      </div>
      {/* Room for the fixed bar on phones. */}
      <div aria-hidden="true" className={cn("h-40 lg:hidden", done && "hidden")} />
    </div>
  );
}

function DeckCardView({
  card,
  draft,
  cardRef,
  headingRef,
  onNoteOpen,
  onNoteChange,
  onPointerDown,
  onPointerMove,
  onPointerEnd,
}: {
  card: DeckCard;
  draft: Draft;
  cardRef: React.RefObject<HTMLElement | null>;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  onNoteOpen: () => void;
  onNoteChange: (note: string) => void;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerEnd: (e: React.PointerEvent) => void;
}) {
  const title = draft.searched ?? candidateTitle(card.candidates[draft.chosen] ?? card.candidates[0]);
  const wroteSomethingElse = normalizeTitle(card.query) !== normalizeTitle(title.name);
  return (
    <article
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      className="flex touch-pan-y flex-col gap-4 transition-transform duration-fast ease-standard"
    >
      <div className="flex items-start gap-4">
        <div className="w-28 shrink-0 md:w-36">
          <Poster title={title} size="grid" eager />
        </div>
        <div className="flex min-w-0 flex-col gap-1 pt-1">
          <h1 ref={headingRef} tabIndex={-1} className="text-title-m text-default">
            {title.name}
          </h1>
          <p className="text-caption text-muted">{titleMeta(title)}</p>
          {card.decision !== "pending" && (
            <p className="flex items-center gap-1 text-caption text-muted">
              <Icon name={card.decision === "added" ? "vouched" : "close"} size={16} />
              {card.decision === "added" ? t("importDeck.added") : t("importDeck.skipped")}
            </p>
          )}
          {wroteSomethingElse && <p className="text-caption text-muted">{t("importDeck.youWrote", { query: card.query })}</p>}
        </div>
      </div>
      {draft.noteOpen ? (
        <NoteField value={draft.note} onValueChange={onNoteChange} />
      ) : (
        <Button variant="ghost" icon="edit" className="-ms-4 self-start" onClick={onNoteOpen}>
          {t("importDeck.addNote")}
        </Button>
      )}
    </article>
  );
}

