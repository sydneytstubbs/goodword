"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/cn";
import { isDesktopPointer } from "@/lib/hooks";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Avatar } from "../ui/avatar";
import { IconButton } from "../ui/icon-button";
import { parseBody } from "./comment";
import { SpoilerToggle } from "./spoiler-cover";
import type { CommentSegment, Person } from "./types";
import { VisibilityLine, type GroupWithCount } from "./visibility-line";

// Composer with mentions (DESIGN-SYSTEM.md 4.2.11). Mentions offer members of
// this group only, never anyone outside it. An inserted mention is atomic:
// Backspace removes the whole "@Name". Desktop: Enter sends, Shift+Enter
// adds a line. Mobile: Return adds a line. Drafts survive for the session.

const MAX = 500;
const COUNTER_AT = 400;
const MAX_SUGGESTIONS = 6;

export type ComposerSend = { body: CommentSegment[]; spoiler: boolean };

/** Prefix matches on the first name first, then contains (4.2.11). */
export function matchMembers(members: Person[], query: string): Person[] {
  const q = query.toLocaleLowerCase("en");
  const prefix = members.filter((m) => m.name.toLocaleLowerCase("en").startsWith(q));
  const contains = members.filter((m) => !prefix.includes(m) && m.name.toLocaleLowerCase("en").includes(q));
  return [...prefix, ...contains].slice(0, MAX_SUGGESTIONS);
}

export function Composer({
  group,
  members,
  viewerId,
  draftKey,
  autoFocus = false,
  hint,
  inputRef,
  onSend,
}: {
  group: GroupWithCount;
  /** Members of this group. */
  members: Person[];
  viewerId: string;
  /** Unsent drafts are kept per title per group for the session. */
  draftKey: string;
  /** "Add a comment…" opens the conversation with the composer focused (DS 5.17). */
  autoFocus?: boolean;
  /** A one-time hint above the field, e.g. suggesting Spoiler (DS 5.17). */
  hint?: ReactNode;
  /** The text field, so the screen can focus it (the empty conversation, DS 5.17). */
  inputRef?: RefObject<HTMLTextAreaElement | null>;
  onSend: (comment: ComposerSend) => void;
}) {
  const [text, setText] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // Where the caret goes once a programmatic change (a mention inserted or
  // removed) has rendered, before the next keystroke can land.
  const pendingCaret = useRef<number | null>(null);
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;

  const others = members.filter((m) => m.id !== viewerId);
  const suggestions = query === null ? [] : matchMembers(others, query);
  const listOpen = query !== null && suggestions.length > 0;
  const empty = text.trim().length === 0;
  const remaining = MAX - text.length;

  // Restore a draft from this session (an external store, read once on mount).
  useEffect(() => {
    const saved = sessionStorage.getItem(`draft:${draftKey}`);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setText(saved);
  }, [draftKey]);

  useEffect(() => {
    if (text) sessionStorage.setItem(`draft:${draftKey}`, text);
    else sessionStorage.removeItem(`draft:${draftKey}`);
  }, [text, draftKey]);

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useLayoutEffect(() => {
    const el = textareaRef.current;
    if (!el || pendingCaret.current === null) return;
    el.focus();
    el.setSelectionRange(pendingCaret.current, pendingCaret.current);
    pendingCaret.current = null;
  }, [text]);

  // Auto-grow 1 to 5 lines; pill-shaped at one line, card-shaped when taller.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const style = getComputedStyle(el);
    const line = parseFloat(style.lineHeight);
    const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
    el.style.height = "auto";
    const height = Math.min(el.scrollHeight + 2, line * 5 + padding + 2);
    el.style.height = `${height}px`;
    if (el.scrollHeight > line + padding + 4) el.dataset.multiline = "";
    else delete el.dataset.multiline;
  }, [text]);

  /** Find an "@query" token ending at the caret. */
  function updateQuery(value: string, caret: number) {
    const match = value.slice(0, caret).match(/(?:^|\s)@([\p{L}\p{M}'-]*)$/u);
    if (!match) {
      setQuery(null);
      return;
    }
    // A space after a query with no match closes the list.
    setQuery(match[1]);
    setActive(0);
  }

  function change(value: string, caret: number) {
    setText(value.slice(0, MAX));
    updateQuery(value, caret);
  }

  function insertMention(person: Person) {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const before = text.slice(0, caret).replace(/@[\p{L}\p{M}'-]*$/u, "");
    const after = text.slice(caret);
    const token = `@${person.name} `;
    const next = before + token + after;
    pendingCaret.current = Math.min(before.length + token.length, MAX);
    setText(next.slice(0, MAX));
    setQuery(null);
  }

  function send() {
    if (empty) return;
    onSend({ body: parseBody(text.trim(), others), spoiler });
    setText("");
    setSpoiler(false);
    setQuery(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (listOpen) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const delta = e.key === "ArrowDown" ? 1 : -1;
        setActive((a) => (a + delta + suggestions.length) % suggestions.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(suggestions[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setQuery(null);
        return;
      }
    }
    // Backspace at the end of a mention removes the whole token.
    const el = e.currentTarget;
    if (e.key === "Backspace" && el.selectionStart === el.selectionEnd) {
      const before = text.slice(0, el.selectionStart);
      const token = others.map((m) => `@${m.name}`).find((m) => before.endsWith(m));
      if (token) {
        e.preventDefault();
        const start = before.length - token.length;
        pendingCaret.current = start;
        setText(text.slice(0, start) + text.slice(el.selectionStart));
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey && isDesktopPointer()) {
      e.preventDefault();
      send();
    }
  }

  function mentionButton() {
    const el = textareaRef.current;
    if (!el) return;
    const caret = el.selectionStart;
    const needsSpace = caret > 0 && !/\s/.test(text[caret - 1]);
    const insert = `${needsSpace ? " " : ""}@`;
    const next = text.slice(0, caret) + insert + text.slice(caret);
    setText(next);
    pendingCaret.current = caret + insert.length;
    setQuery("");
    setActive(0);
  }

  return (
    <div className="relative flex flex-col gap-2 border-t border-subtle bg-surface px-4 pt-2 pb-safe-footer">
      {listOpen && (
        <ul
          id={listId}
          role="listbox"
          aria-label={t("composer.suggestionsLabel", { group: group.name })}
          className="absolute inset-x-4 bottom-full mb-2 rounded-card border border-subtle bg-surface-raised p-1 shadow-md fc-edge"
        >
          {suggestions.map((person, i) => (
            <li
              key={person.id}
              id={optionId(i)}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(person);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn(
                "flex min-h-target cursor-pointer items-center gap-3 rounded-control px-3 text-body text-default",
                i === active && "bg-surface-hover fc-selected",
              )}
            >
              <Avatar person={person} size={24} decorative />
              {person.name}
            </li>
          ))}
        </ul>
      )}
      <span className="sr-only" aria-live="polite">
        {listOpen ? t("composer.suggestions", { count: suggestions.length }) : ""}
      </span>
      <VisibilityLine groups={[group]} peopleCount={group.memberCount} compact />
      {hint}
      <label htmlFor={`${listId}-input`} className="sr-only">
        {t("composer.label")}
      </label>
      <textarea
        id={`${listId}-input`}
        ref={(el) => {
          textareaRef.current = el;
          if (inputRef) inputRef.current = el;
        }}
        rows={1}
        value={text}
        maxLength={MAX}
        placeholder={t("composer.placeholder", { group: group.name })}
        // A textarea can't take role="combobox" in HTML, so it keeps its textbox role
        // with the autocomplete attributes that role supports.
        aria-autocomplete="list"
        aria-controls={listOpen ? listId : undefined}
        aria-activedescendant={listOpen ? optionId(active) : undefined}
        onChange={(e) => change(e.target.value, e.target.selectionStart)}
        onKeyDown={onKeyDown}
        onClick={(e) => updateQuery(text, e.currentTarget.selectionStart)}
        onBlur={() => setQuery(null)}
        className="resize-none rounded-pill border border-strong bg-surface-raised px-4 py-2.5 text-body text-default placeholder:text-muted caret-action data-multiline:rounded-card fc-edge focus:border-action"
      />
      <div className="flex items-center gap-1">
        <IconButton icon="mention" label={t("composer.mention")} tone="muted" onClick={mentionButton} tooltipSide="top" />
        <SpoilerToggle on={spoiler} onToggle={() => setSpoiler((s) => !s)} />
        {text.length >= COUNTER_AT && (
          <span aria-hidden="true" className={cn("ms-auto text-caption tabular-nums", remaining === 0 ? "text-danger" : "text-muted")}>
            {t("field.charactersLeft", { count: remaining })}
          </span>
        )}
        <button
          type="button"
          onClick={send}
          aria-disabled={empty || undefined}
          aria-label={empty ? t("composer.sendEmpty") : t("composer.send")}
          className={cn(
            "group grid size-target place-items-center",
            text.length < COUNTER_AT && "ms-auto",
            empty && "cursor-not-allowed",
          )}
        >
          <span
            className={cn(
              "grid size-9 place-items-center rounded-pill bg-action text-on-action transition duration-fast ease-standard fc-edge",
              empty ? "opacity-40" : "group-hover:bg-action-hover group-active:bg-action-hover",
            )}
          >
            <Icon name="send" size={20} />
          </span>
        </button>
      </div>
    </div>
  );
}
