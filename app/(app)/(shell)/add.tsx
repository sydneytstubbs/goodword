"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Poster } from "@/components/domain/poster";
import { TitleSearch, type SearchAnnotations } from "@/components/domain/title-search";
import type { GoodWordSource, MyGoodWord, Person, Title } from "@/components/domain/types";
import { ConfirmGoodWord, NoteField } from "@/components/domain/confirm-good-word";
import { GroupPickerFields, VisibilityLine, type GroupWithCount } from "@/components/domain/visibility-line";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/messages";
import { useGoodWords } from "./good-words";
import { track } from "@/lib/events/client";
import { useCaptureVisitSource, visitSource } from "./visit-source";

// Add (PRD 6.2, DS 5.4): a command, not a destination. One sheet over the
// current screen: search, then the confirm step (poster, optional note, and
// the visibility line, defaulting to all your groups). The group picker, Edit
// note, and Change groups replace the sheet's content rather than stacking a
// second sheet (DS 4.1.13). Opening pushes a history entry so the Back
// gesture closes the sheet (DS 5.1).

const RECENT_KEY = "gw:recent-searches";
const DRAFT_KEY = "gw:draft:";

/** Where Add was opened from, for measurement (PRD 11.2). */
export type AddEntryPoint = "tab" | "rail" | "shortcut" | "title" | "search_row" | "join_prompt" | "empty_state" | "email";
export type OpenAddOptions = { title?: Title; source?: GoodWordSource; entryPoint?: AddEntryPoint };

type AddContextValue = {
  openAdd: (options?: OpenAddOptions) => void;
  openEditNote: (title: Title, mine: MyGoodWord) => void;
  openChangeGroups: (title: Title, mine: MyGoodWord) => void;
};
const AddContext = createContext<AddContextValue | null>(null);

export function useAdd(): AddContextValue {
  const value = useContext(AddContext);
  if (!value) throw new Error("useAdd must be used inside <AddProvider>");
  return value;
}

type ServerAnnotations = { mine: Record<string, MyGoodWord>; friends: Record<string, Person[]> };

// Recent searches live on this device only (PRD F3).
function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((q): q is string => typeof q === "string").slice(0, 5) : [];
  } catch {
    return [];
  }
}

function writeRecent(recent: string[]) {
  try {
    if (recent.length === 0) localStorage.removeItem(RECENT_KEY);
    else localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
  } catch {
    // Private browsing or storage full: recent searches just aren't remembered.
  }
}

// A typed note survives dismissing the sheet, for the session (DS 5.4).
function readDraft(titleId: string): string | null {
  try {
    return sessionStorage.getItem(DRAFT_KEY + titleId);
  } catch {
    return null;
  }
}

function writeDraft(titleId: string, note: string) {
  try {
    if (note) sessionStorage.setItem(DRAFT_KEY + titleId, note);
    else sessionStorage.removeItem(DRAFT_KEY + titleId);
  } catch {
    // Storage unavailable: the draft lasts as long as the sheet.
  }
}

const isSheetEntry = () => (window.history.state as { gwSheet?: string } | null)?.gwSheet === "add";

const isTyping = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

type View =
  | { kind: "search" }
  | { kind: "confirm"; title: Title }
  | { kind: "picker"; title: Title }
  | { kind: "editNote"; title: Title; mine: MyGoodWord }
  | { kind: "groups"; title: Title; mine: MyGoodWord };

export function AddProvider({ children }: { children: ReactNode }) {
  const { groups, overlays, mineFor, put, editNote, setGroups } = useGoodWords();
  useCaptureVisitSource();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>({ kind: "search" });
  // A fresh search each time the sheet opens.
  const [session, setSession] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [source, setSource] = useState<GoodWordSource>("organic");
  // When Add opened, for the time to put in a good word (PRD 2.2, H3).
  const openedAt = useRef(0);
  const [note, setNote] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [annotations, setAnnotations] = useState<ServerAnnotations>({ mine: {}, friends: {} });

  const allIds = groups.map((g) => g.id);
  const withCounts: GroupWithCount[] = groups.map((g) => ({ id: g.id, name: g.name, memberCount: g.members.length }));
  const peopleIn = (ids: string[]) =>
    new Set(groups.filter((g) => ids.includes(g.id)).flatMap((g) => g.members.map((m) => m.id))).size;

  const pushEntry = () => {
    if (!isSheetEntry()) window.history.pushState({ ...window.history.state, gwSheet: "add" }, "");
  };

  const mineOf = useCallback(
    (title: Title) => mineFor(title.id, annotations.mine[title.id] ?? null),
    [mineFor, annotations],
  );

  const confirm = useCallback(
    (title: Title) => {
      const mine = mineOf(title);
      setNote(readDraft(title.id) ?? mine?.note ?? "");
      setSelected(groups.map((g) => g.id));
      setView({ kind: "confirm", title });
    },
    [mineOf, groups],
  );

  const openAdd = useCallback(
    (options: OpenAddOptions = {}) => {
      setSource(options.source ?? visitSource() ?? "organic");
      openedAt.current = Date.now();
      if (options.entryPoint) track("add_opened", { entry_point: options.entryPoint });
      if (options.title) confirm(options.title);
      else {
        setRecent(readRecent());
        setSession((s) => s + 1);
        setView({ kind: "search" });
      }
      setOpen(true);
      pushEntry();
    },
    [confirm],
  );

  const openEditNote = useCallback((title: Title, mine: MyGoodWord) => {
    setNote(mine.note);
    setView({ kind: "editNote", title, mine });
    setOpen(true);
    pushEntry();
  }, []);

  const openChangeGroups = useCallback((title: Title, mine: MyGoodWord) => {
    setSelected(mine.groupIds);
    setView({ kind: "groups", title, mine });
    setOpen(true);
    pushEntry();
  }, []);

  // Back (or the swipe-back gesture) leaves the sheet's history entry: close it.
  useEffect(() => {
    const onPopState = () => {
      if (!isSheetEntry()) setOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // The weekend prompt's button links to ?add=1 (PRD F7.2): open Add once,
  // then drop the parameter so Back or a reload doesn't open it again.
  const pathname = usePathname();
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("add") !== "1") return;
    url.searchParams.delete("add");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openAdd({ entryPoint: "email" });
  }, [pathname, openAdd]);

  // `n` (put in a good word) and `/` (search) open Add on desktop (PRD F4, DS
  // 3.9), unless you're typing or a sheet is open.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.key !== "n" && e.key !== "/") || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isTyping(e.target)) return;
      if (document.querySelector("dialog[open], [role='menu']")) return;
      e.preventDefault();
      openAdd({ entryPoint: "shortcut" });
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openAdd]);

  const close = useCallback(() => {
    if (isSheetEntry()) window.history.back();
    else setOpen(false);
  }, []);

  /** The app's own search route (PRD F3); TMDB is only ever called server-side. */
  const search = useCallback(async (query: string, signal: AbortSignal): Promise<Title[]> => {
    const res = await fetch(`/api/titles/search?q=${encodeURIComponent(query)}`, { signal });
    if (!res.ok) throw new Error(`Search failed: ${res.status}`);
    const data = (await res.json()) as { results: Title[]; annotations?: ServerAnnotations };
    if (data.annotations) {
      const found = data.annotations;
      setAnnotations((a) => ({ mine: { ...a.mine, ...found.mine }, friends: { ...a.friends, ...found.friends } }));
    }
    return data.results;
  }, []);

  const searchAnnotations: SearchAnnotations = {
    onYourShelf: [...new Set([...Object.keys(annotations.mine), ...overlays.map((o) => o.title.id)])].filter(
      (id) => mineFor(id, annotations.mine[id] ?? null) !== null,
    ),
    friends: annotations.friends,
  };

  function changeNote(value: string, title: Title) {
    setNote(value);
    writeDraft(title.id, value);
  }

  function submitPut(title: Title) {
    // Without a connection it's queued on this device and sent on reconnect (PRD F12).
    const typed = note;
    writeDraft(title.id, "");
    const msFromAddOpened = openedAt.current ? Date.now() - openedAt.current : undefined;
    put(title, { note: typed, groupIds: selected, source, msFromAddOpened }, mineOf(title), () => writeDraft(title.id, typed));
    close();
  }

  let sheetTitle = t("vouch.put");
  let body: ReactNode = null;
  let footer: ReactNode = undefined;

  if (view.kind === "search") {
    body = (
      <TitleSearch
        key={session}
        search={search}
        onSelect={confirm}
        onClose={close}
        annotations={searchAnnotations}
        recent={recent}
        onRecentChange={writeRecent}
      />
    );
    // A list to add in bulk goes to Add recs (PRD F15).
    footer = (
      <ButtonLink href="/you/import" variant="ghost" icon="screenshots" fullWidth onClick={() => setOpen(false)}>
        {t("importRecs.fromSheet")}
      </ButtonLink>
    );
  } else if (view.kind === "confirm") {
    const { title } = view;
    const mine = mineOf(title);
    // Already on every shelf picked: offer Edit note instead (DS 5.4).
    const already = mine !== null && selected.every((id) => mine.groupIds.includes(id));
    const chosen = withCounts.filter((g) => selected.includes(g.id));
    body = (
      <ConfirmGoodWord
        title={title}
        note={note}
        onNoteChange={(value) => changeNote(value, title)}
        already={already}
        groups={chosen}
        peopleCount={peopleIn(selected)}
        onChangeGroups={groups.length > 0 ? () => setView({ kind: "picker", title }) : undefined}
      />
    );
    footer = already ? (
      <Button variant="primary" size="lg" icon="edit" fullWidth onClick={() => mine && openEditNote(title, mine)}>
        {t("vouch.editNote")}
      </Button>
    ) : (
      <Button variant="primary" size="lg" icon="add" fullWidth onClick={() => submitPut(title)}>
        {t("vouch.put")}
      </Button>
    );
  } else if (view.kind === "picker" || view.kind === "groups") {
    sheetTitle = t("visibility.pickerTitle");
    body = <GroupPickerFields groups={withCounts} selectedIds={selected} onSelectedChange={setSelected} />;
    const done = () => {
      if (view.kind === "picker") setView({ kind: "confirm", title: view.title });
      else {
        const { title, mine } = view;
        const changed = selected.length !== mine.groupIds.length || selected.some((id) => !mine.groupIds.includes(id));
        if (changed) setGroups(title, mine, allIds.filter((id) => selected.includes(id)));
        close();
      }
    };
    footer = (
      <div className="flex flex-col gap-3">
        <VisibilityLine groups={withCounts.filter((g) => selected.includes(g.id))} peopleCount={peopleIn(selected)} compact />
        <Button variant="primary" size="lg" fullWidth onClick={done}>
          {t("common.done")}
        </Button>
      </div>
    );
  } else if (view.kind === "editNote") {
    const { title, mine } = view;
    sheetTitle = t("vouch.editNote");
    body = (
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <Poster title={title} size="row" />
          <p className="line-clamp-2 text-card-title text-default">{title.name}</p>
        </div>
        <NoteField value={note} onValueChange={setNote} />
      </div>
    );
    footer = (
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={() => {
          if (note.trim() !== mine.note) editNote(title, mine, note);
          close();
        }}
      >
        {t("vouch.saveNote")}
      </Button>
    );
  }

  return (
    <AddContext.Provider value={{ openAdd, openEditNote, openChangeGroups }}>
      {children}
      <Sheet open={open} onClose={close} title={sheetTitle} footer={footer} tall>
        <ViewFocus viewKey={view.kind} open={open}>
          {body}
        </ViewFocus>
      </Sheet>
    </AddContext.Provider>
  );
}

/**
 * Moving between steps inside the open sheet replaces its content, so focus
 * moves to the new step's first field (or first control), never to the page.
 */
function ViewFocus({ viewKey, open, children }: { viewKey: string; open: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useEffect(() => {
    if (!open) {
      first.current = true;
      return;
    }
    // The sheet itself focuses the first field when it opens.
    if (first.current) {
      first.current = false;
      return;
    }
    const dialog = ref.current?.closest("dialog");
    const target =
      ref.current?.querySelector<HTMLElement>("input, textarea") ??
      ref.current?.querySelector<HTMLElement>("button, [href]") ??
      dialog?.querySelector<HTMLElement>("h2");
    if (target && !target.hasAttribute("tabindex") && target.tagName === "H2") target.setAttribute("tabindex", "-1");
    target?.focus();
  }, [viewKey, open]);
  return <div ref={ref}>{children}</div>;
}
