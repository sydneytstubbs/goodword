"use client";

import { useRouter } from "next/navigation";
import { createContext, startTransition, useCallback, useContext, useOptimistic, useRef, useState, type ReactNode } from "react";
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

type GoodWordsValue = {
  viewer: Person;
  groups: SwitcherGroup[];
  overlays: Overlay[];
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

  const mineFor = useCallback(
    (titleId: string, server: MyGoodWord | null) => {
      const overlay = overlays.find((o) => o.title.id === titleId);
      return overlay ? overlay.mine : server;
    },
    [overlays],
  );

  return (
    <GoodWordsContext.Provider
      value={{
        viewer,
        groups,
        overlays,
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
