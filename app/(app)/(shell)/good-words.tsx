"use client";

import { useRouter } from "next/navigation";
import { createContext, startTransition, useCallback, useContext, useEffect, useMemo, useOptimistic, useRef, useState, type ReactNode } from "react";
import type { SwitcherGroup } from "@/components/domain/group-switcher";
import type { GoodWordSource, MyGoodWord, Person, Title } from "@/components/domain/types";
import { useToast } from "@/components/ui/toast";
import {
  editGoodWordNote,
  putGoodWord,
  restoreGoodWord,
  setGoodWordGroups,
  takeBackGoodWord,
  type Milestone,
  type TitleRef,
  type WriteResult,
} from "@/lib/good-words/actions";
import type { Overlay } from "@/lib/good-words/shelf";
import { audienceNames } from "@/lib/format";
import { t } from "@/lib/messages";

// The viewer's good words, written optimistically (DS 5.10, PRD F4): a change
// shows everywhere at once as an overlay on the server-rendered shelves and
// title screens, while the server action runs. When it lands, the refreshed
// server data takes over; if it fails, the overlay drops (the change reverts)
// and a toast offers Retry. Writes run one at a time, so Undo never overtakes
// the change it undoes.

export type PutInput = { note: string; groupIds: string[]; source: GoodWordSource; msFromAddOpened?: number };

/**
 * A good word put in offline (PRD F12, DS 5.12): kept on this device, shown
 * everywhere as if it were saved, captioned "Sending when you're back
 * online", and sent on reconnect. If the server turns it down, it stays with
 * Retry and Remove.
 */
export type QueuedGoodWord = { title: Title; input: PutInput; mine: MyGoodWord; status: "waiting" | "failed" };

type GoodWordsValue = {
  viewer: Person;
  groups: SwitcherGroup[];
  overlays: Overlay[];
  queued: QueuedGoodWord[];
  retryQueued: (titleId: string) => void;
  removeQueued: (titleId: string) => void;
  /** The viewer's good word on a title right now: pending changes over what the server said. */
  mineFor: (titleId: string, server: MyGoodWord | null) => MyGoodWord | null;
  put: (title: Title, input: PutInput, previous: MyGoodWord | null, onFail?: () => void) => void;
  editNote: (title: Title, mine: MyGoodWord, note: string) => void;
  setGroups: (title: Title, mine: MyGoodWord, groupIds: string[]) => void;
  takeBack: (title: Title, mine: MyGoodWord) => void;
  milestone: Milestone | null;
  dismissMilestone: () => void;
};

const GoodWordsContext = createContext<GoodWordsValue | null>(null);

export function useGoodWords(): GoodWordsValue {
  const value = useContext(GoodWordsContext);
  if (!value) throw new Error("useGoodWords must be used inside <GoodWordsProvider>");
  return value;
}

const ref = (title: Title): TitleRef => ({ type: title.type, tmdbId: title.tmdbId ?? 0 });

/** Shelves it's newly on get "now"; shelves it stays on keep their date. */
function withGroups(mine: MyGoodWord, groupIds: string[], now: string): MyGoodWord {
  return {
    ...mine,
    groupIds,
    sharedAt: Object.fromEntries(groupIds.map((id) => [id, mine.sharedAt[id] ?? now])),
  };
}

export function GoodWordsProvider({
  viewer,
  groups,
  children,
}: {
  viewer: Person;
  groups: SwitcherGroup[];
  children: ReactNode;
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [overlays, addOverlay] = useOptimistic<Overlay[], Overlay>([], (state, next) => [
    ...state.filter((o) => o.title.id !== next.title.id),
    next,
  ]);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [milestone, setMilestone] = useState<Milestone | null>(null);

  // Offline good words, kept per person on this device.
  const storageKey = `gw:queued:${viewer.id}`;
  const [queued, setQueued] = useState<QueuedGoodWord[]>([]);
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(saved)) setQueued(saved as QueuedGoodWord[]);
    } catch {
      // Storage unavailable: nothing was queued on this device.
    }
    loaded.current = true;
  }, [storageKey]);
  useEffect(() => {
    if (!loaded.current) return;
    try {
      if (queued.length === 0) localStorage.removeItem(storageKey);
      else localStorage.setItem(storageKey, JSON.stringify(queued));
    } catch {
      // Storage full or unavailable: the queue lasts as long as the page.
    }
  }, [queued, storageKey]);

  // Send what's waiting, one at a time. A dropped connection leaves the rest
  // waiting; a refusal from the server marks that one failed.
  const sending = useRef(false);
  const flush = useCallback(async () => {
    if (sending.current || !navigator.onLine) return;
    sending.current = true;
    let sent = false;
    try {
      const waiting = queued.filter((q) => q.status === "waiting");
      for (const item of waiting) {
        let result: WriteResult;
        try {
          result = await putGoodWord(ref(item.title), item.input);
        } catch {
          break;
        }
        if (result.ok) {
          sent = true;
          setQueued((q) => q.filter((x) => x.title.id !== item.title.id));
          if (result.milestone) setMilestone(result.milestone);
        } else {
          setQueued((q) => q.map((x) => (x.title.id === item.title.id ? { ...x, status: "failed" } : x)));
        }
      }
    } finally {
      sending.current = false;
      if (sent) router.refresh();
    }
  }, [queued, router]);
  useEffect(() => {
    if (queued.some((q) => q.status === "waiting")) void flush();
    window.addEventListener("online", flush);
    return () => window.removeEventListener("online", flush);
  }, [flush, queued]);

  const retryQueued = useCallback((titleId: string) => {
    setQueued((q) => q.map((x) => (x.title.id === titleId ? { ...x, status: "waiting" } : x)));
  }, []);
  const removeQueued = useCallback((titleId: string) => {
    setQueued((q) => q.filter((x) => x.title.id !== titleId));
  }, []);

  /** Shows `overlay` now, runs `write` after any earlier writes, then reports. */
  const run = useCallback(
    (overlay: Overlay, write: () => Promise<WriteResult>, done: (result: WriteResult) => void) => {
      startTransition(async () => {
        addOverlay(overlay);
        const previous = queue.current;
        let release = () => {};
        queue.current = new Promise((resolve) => (release = resolve));
        await previous;
        let result: WriteResult;
        try {
          result = await write();
        } catch {
          result = { ok: false, error: "failed" };
        }
        release();
        done(result);
      });
    },
    [addOverlay],
  );

  const retryToast = useCallback(
    (retry: () => void) => showToast({ message: t("vouch.didntSave"), action: { label: t("common.retry"), onAction: retry } }),
    [showToast],
  );

  const failed = useCallback(
    (result: WriteResult, retry: () => void) => {
      if (result.ok) return;
      if (result.error === "rateLimited") showToast({ message: t("vouch.rateLimited") });
      else retryToast(retry);
    },
    [showToast, retryToast],
  );

  // Undo puts the good word back exactly as it was, quietly: the change it
  // undoes was already confirmed with a toast.
  const revert = useCallback(
    (title: Title, previous: MyGoodWord | null) => {
      const write = () => (previous ? restoreGoodWord(ref(title), previous) : takeBackGoodWord(ref(title)));
      const attempt = () => run({ title, mine: previous }, write, (result) => failed(result, attempt));
      attempt();
    },
    [run, failed],
  );

  const audienceToast = useCallback(
    (groupIds: string[]) => {
      const seen = new Set<string>();
      const names: string[] = [];
      for (const group of groups.filter((g) => groupIds.includes(g.id))) {
        for (const member of group.members) {
          if (member.id === viewer.id || seen.has(member.id)) continue;
          seen.add(member.id);
          names.push(member.name);
        }
      }
      if (names.length > 0) return t("vouch.onShelfAudience", { names: audienceNames(names) });
      return groupIds.length === 0 && groups.length > 0 ? t("vouch.onShelfOnlyYou") : null;
    },
    [groups, viewer.id],
  );

  const put = useCallback(
    (title: Title, input: PutInput, previous: MyGoodWord | null, onFail?: () => void) => {
      const now = new Date().toISOString();
      const mine = withGroups(
        previous ? { ...previous, note: input.note } : { note: input.note, groupIds: [], createdAt: now, source: input.source, sharedAt: {} },
        input.groupIds,
        now,
      );
      // Offline: keep it on this device and send it on reconnect (PRD F12).
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        setQueued((q) => [...q.filter((x) => x.title.id !== title.id), { title, input, mine, status: "waiting" }]);
        showToast({ message: t("vouch.queued") });
        return;
      }
      // "On your shelf. Priya, Jonah, and 4 others will see it." with Undo, or,
      // with nobody else to see it yet, an Invite action (F4).
      const message = audienceToast(input.groupIds);
      if (message) {
        showToast({ message, action: { label: t("common.undo"), onAction: () => revert(title, previous) } });
      } else {
        const onlyGroup = input.groupIds.length === 1 ? input.groupIds[0] : null;
        showToast({
          message: t("vouch.onShelfInvite"),
          action: { label: t("vouch.invite"), onAction: () => router.push(onlyGroup ? `/groups/${onlyGroup}` : "/groups/new") },
        });
      }
      const attempt = () =>
        run({ title, mine }, () => putGoodWord(ref(title), input), (result) => {
          if (result.ok) {
            if (result.milestone) setMilestone(result.milestone);
            return;
          }
          onFail?.();
          failed(result, attempt);
        });
      attempt();
    },
    [audienceToast, showToast, revert, router, run, failed],
  );

  const editNote = useCallback(
    (title: Title, mine: MyGoodWord, note: string) => {
      const attempt = () =>
        run({ title, mine: { ...mine, note: note.trim() } }, () => editGoodWordNote(ref(title), note), (result) =>
          failed(result, attempt),
        );
      attempt();
    },
    [run, failed],
  );

  const setGroups = useCallback(
    (title: Title, mine: MyGoodWord, groupIds: string[]) => {
      const next = withGroups(mine, groupIds, new Date().toISOString());
      const attempt = () =>
        run({ title, mine: next }, () => setGoodWordGroups(ref(title), groupIds), (result) => failed(result, attempt));
      attempt();
    },
    [run, failed],
  );

  const takeBack = useCallback(
    (title: Title, mine: MyGoodWord) => {
      // Immediate, with an 8-second Undo; no confirm dialog (DS 4.2.3, 5.11).
      showToast({ message: t("vouch.takenBack"), action: { label: t("common.undo"), onAction: () => revert(title, mine) } });
      const attempt = () =>
        run({ title, mine: null }, () => takeBackGoodWord(ref(title)), (result) => failed(result, attempt));
      attempt();
    },
    [showToast, revert, run, failed],
  );

  // Queued good words show like saved ones; a change in flight wins over them.
  const shown: Overlay[] = useMemo(
    () => [
      ...queued.filter((q) => !overlays.some((o) => o.title.id === q.title.id)).map((q) => ({ title: q.title, mine: q.mine })),
      ...overlays,
    ],
    [queued, overlays],
  );

  const mineFor = useCallback(
    (titleId: string, server: MyGoodWord | null) => {
      const overlay = shown.find((o) => o.title.id === titleId);
      return overlay ? overlay.mine : server;
    },
    [shown],
  );

  return (
    <GoodWordsContext.Provider
      value={{
        viewer,
        groups,
        overlays: shown,
        queued,
        retryQueued,
        removeQueued,
        mineFor,
        put,
        editNote,
        setGroups,
        takeBack,
        milestone,
        dismissMilestone: () => setMilestone(null),
      }}
    >
      {children}
    </GoodWordsContext.Provider>
  );
}
