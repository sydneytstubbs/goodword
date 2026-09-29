"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { nameList } from "@/lib/format";
import { useDelayedFlag } from "@/lib/hooks";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { AvatarStack } from "../ui/avatar";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { Skeleton, SkeletonRegion } from "../ui/skeleton";
import { TextField } from "../ui/text-field";
import { Poster } from "./poster";
import { titleMeta } from "./title-meta";
import type { Person, Title } from "./types";

// Title search (DESIGN-SYSTEM.md 4.2.4, 5.5). Combobox with a listbox:
// arrows move, Enter selects, Esc clears then closes. 250ms debounce,
// 2+ characters, and a new query cancels the request in flight. Annotations
// prevent duplicates. `search` is the app's TMDB route, or any async function.

const DEBOUNCE_MS = 250;
const MIN_CHARS = 2;
const MAX_RECENT = 5;

export type SearchAnnotations = {
  /** Titles you've already vouched for. */
  onYourShelf?: string[];
  /** Friends who vouched, by title id. */
  friends?: Record<string, Person[]>;
};

/** How the last finished search came out; "none" before one finishes. */
type Settled = "none" | "results" | "empty" | "error" | "offline";
type Status = Settled | "idle" | "loading";

export function TitleSearch({
  search,
  onSelect,
  onClose,
  annotations = {},
  recent: initialRecent = [],
  onRecentChange,
  autoFocus = false,
}: {
  search: (query: string, signal: AbortSignal) => Promise<Title[]>;
  onSelect: (title: Title) => void;
  /** Esc on an empty field closes the search sheet. */
  onClose?: () => void;
  annotations?: SearchAnnotations;
  /** Recent searches, newest first (stored on the device by the caller). */
  recent?: string[];
  onRecentChange?: (recent: string[]) => void;
  autoFocus?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState<Settled>("none");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Title[]>([]);
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState(initialRecent.slice(0, MAX_RECENT));
  const [attempt, setAttempt] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;
  const trimmed = query.trim();

  useEffect(() => {
    if (trimmed.length < MIN_CHARS) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await search(trimmed, controller.signal);
        if (controller.signal.aborted) return;
        setResults(found);
        setActive(0);
        setSettled(found.length > 0 ? "results" : "empty");
      } catch {
        if (controller.signal.aborted) return;
        setSettled(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "error");
      }
      setLoading(false);
    }, DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, search, attempt]);

  // The skeleton shows only after 300ms, then stays at least 500ms (DS 4.1.17).
  // Until then, the last results stay put.
  const slow = useDelayedFlag(trimmed.length >= MIN_CHARS && loading);
  const shown: Status = trimmed.length < MIN_CHARS ? "idle" : slow ? "loading" : settled;
  const expanded = shown === "results";

  function changeQuery(next: string) {
    setQuery(next);
    if (next.trim().length < MIN_CHARS) {
      setSettled("none");
      setLoading(false);
    }
  }

  function updateRecent(next: string[]) {
    setRecent(next);
    onRecentChange?.(next);
  }

  function select(title: Title) {
    updateRecent([trimmed, ...recent.filter((q) => q !== trimmed)].slice(0, MAX_RECENT));
    onSelect(title);
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" && expanded) {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp" && expanded) {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && expanded) {
      e.preventDefault();
      // Results for an older query are still on screen while a new one loads.
      if (!loading) select(results[active]);
    } else if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        e.stopPropagation();
        changeQuery("");
      } else {
        onClose?.();
      }
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <TextField
        ref={inputRef}
        label={t("search.label")}
        hideLabel
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={t("search.label")}
        value={query}
        onChange={(e) => changeQuery(e.target.value)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? optionId(active) : undefined}
        leading={<Icon name="search" size={20} />}
        trailing={
          query ? (
            <IconButton
              icon="close"
              tone="muted"
              tooltip={false}
              label={t("search.clear")}
              onClick={() => {
                changeQuery("");
                inputRef.current?.focus();
              }}
            />
          ) : undefined
        }
      />

      <span className="sr-only" aria-live="polite">
        {shown === "results" ? t("search.results", { count: results.length }) : ""}
      </span>

      {shown === "idle" && recent.length > 0 && (
        <section className="flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="text-caption font-semibold text-muted">{t("search.recent")}</h3>
            <Button variant="ghost" size="sm" onClick={() => updateRecent([])}>
              {t("search.clearRecent")}
            </Button>
          </div>
          <ul>
            {recent.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => changeQuery(item)}
                  className="flex min-h-target w-full items-center gap-3 rounded-control px-1 text-start text-body text-default hover:bg-surface-hover"
                >
                  <Icon name="search" size={16} className="text-muted" />
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {shown === "loading" && (
        <SkeletonRegion label={t("search.loading")}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3 border-b border-subtle py-3">
              <Skeleton className="aspect-2/3 w-12 rounded-poster" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3 rounded-control" />
                <Skeleton className="h-3 w-1/3 rounded-control" />
              </div>
            </div>
          ))}
        </SkeletonRegion>
      )}

      <ul
        id={listId}
        role="listbox"
        aria-label={t("search.label")}
        aria-busy={loading || undefined}
        hidden={!expanded}
      >
        {expanded &&
          results.map((title, i) => {
            const onShelf = annotations.onYourShelf?.includes(title.id);
            const friends = annotations.friends?.[title.id] ?? [];
            return (
              <li
                key={title.id}
                id={optionId(i)}
                role="option"
                aria-selected={i === active}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(title)}
                onMouseEnter={() => setActive(i)}
                className={cn(
                  "flex cursor-pointer items-center gap-3 border-b border-subtle px-1 py-3",
                  i === active && "bg-surface-hover fc-selected",
                )}
              >
                <Poster title={title} size="row" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="line-clamp-2 text-card-title text-default">{title.name}</span>
                  <span className="text-caption text-muted">{titleMeta(title)}</span>
                  {onShelf ? (
                    <span className="inline-flex items-center gap-1 text-caption font-medium text-action-text">
                      <Icon name="vouched" size={16} />
                      {t("search.onYourShelf")}
                    </span>
                  ) : friends.length > 0 ? (
                    <span className="flex items-center gap-2">
                      <AvatarStack people={friends} size={24} ring="surface-raised" />
                      <span className="text-caption text-muted">
                        {t("search.friendsVouched", { names: nameList(friends.map((f) => f.name)) })}
                      </span>
                    </span>
                  ) : null}
                </span>
              </li>
            );
          })}
      </ul>

      {shown === "empty" && <p className="text-body text-muted">{t("search.noResults", { query: trimmed })}</p>}

      {(shown === "error" || shown === "offline") && (
        <div role="alert" className="flex flex-col items-start gap-3">
          <p className="flex items-center gap-2 text-body text-default">
            <Icon name={shown === "offline" ? "offline" : "error"} size={20} className="shrink-0 text-muted" />
            {shown === "offline" ? t("search.offline") : t("search.error")}
          </p>
          <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
            {t("common.retry")}
          </Button>
        </div>
      )}
    </div>
  );
}
