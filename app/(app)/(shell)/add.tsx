"use client";

import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { TitleSearch } from "@/components/domain/title-search";
import type { Title } from "@/components/domain/types";
import { Sheet } from "@/components/ui/sheet";
import { t } from "@/lib/messages";

// Add (PRD 6.2, DS 5.4): a command, not a destination. It opens the search
// sheet over the current screen. Opening pushes a history entry so the Back
// gesture closes the sheet (DS 5.1). In step 3, picking a result opens the
// title; step 4 replaces that with the confirm sheet.

const RECENT_KEY = "gw:recent-searches";

type AddContextValue = { openAdd: () => void };
const AddContext = createContext<AddContextValue | null>(null);

export function useAdd(): AddContextValue {
  const value = useContext(AddContext);
  if (!value) throw new Error("useAdd must be used inside <AddProvider>");
  return value;
}

/** The app's own search route (PRD F3); TMDB is only ever called server-side. */
async function searchTitles(query: string, signal: AbortSignal): Promise<Title[]> {
  const res = await fetch(`/api/titles/search?q=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error(`Search failed: ${res.status}`);
  const data = (await res.json()) as { results: Title[] };
  return data.results;
}

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

const isSheetEntry = () => (window.history.state as { gwSheet?: string } | null)?.gwSheet === "add";

export function AddProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  // A fresh search each time the sheet opens.
  const [session, setSession] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);

  const openAdd = useCallback(() => {
    setRecent(readRecent());
    setSession((s) => s + 1);
    setOpen(true);
    if (!isSheetEntry()) window.history.pushState({ ...window.history.state, gwSheet: "add" }, "");
  }, []);

  // Back (or the swipe-back gesture) leaves the sheet's history entry: close it.
  useEffect(() => {
    const onPopState = () => {
      if (!isSheetEntry()) setOpen(false);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const close = useCallback(() => {
    if (isSheetEntry()) window.history.back();
    else setOpen(false);
  }, []);

  const select = useCallback(
    (title: Title) => {
      setOpen(false);
      // Replace the sheet's entry, so Back from the title returns to where Add was opened.
      router.replace(`/title/${title.type}/${title.tmdbId}`);
    },
    [router],
  );

  return (
    <AddContext.Provider value={{ openAdd }}>
      {children}
      <Sheet open={open} onClose={close} title={t("vouch.put")}>
        <TitleSearch key={session} search={searchTitles} onSelect={select} recent={recent} onRecentChange={writeRecent} />
      </Sheet>
    </AddContext.Provider>
  );
}
