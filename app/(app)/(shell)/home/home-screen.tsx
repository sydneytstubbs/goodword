"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FilterBar, type FilterChange } from "@/components/domain/filter-bar";
import { FriendLinkCard } from "@/components/domain/friend-link-card";
import { CaughtUpMarker, ImportRollupLine, RecCardHome } from "@/components/domain/rec-card";
import type { Group, ListCard, MyGoodWord, Service } from "@/components/domain/types";
import { VouchButton } from "@/components/domain/vouch-button";
import type { SwitcherGroup } from "@/components/domain/group-switcher";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { track } from "@/lib/events/client";
import { clearFilters, filterList, filtersToQuery, genreCounts, isFiltered, PAGE_SIZE, parseFilters, serviceCounts } from "@/lib/good-words/filters";
import type { ImportRollup } from "@/lib/good-words/queries";
import { applyOverlays } from "@/lib/good-words/list";
import { t } from "@/lib/messages";
import { useAdd } from "../add";
import { useGoodWords } from "../good-words";
import { ListBar } from "../list/list-bar";
import { ListMilestone, NoResults, useStuck } from "../list/list-cards";
import { LiveList } from "../list/live-list";

// Home (PRD F16.3, DS 5.19): what your friends are vouching for, one card
// per title, newest first. Cards new since your last visit come first, then
// "You're all caught up". Earlier cards load 24 at a time, only on a tap, so
// Home ends. Import roll-up lines sit between cards at their time. The order
// never changes under you: new good words wait behind the live pill.

const VIEW_AFTER_MS = 10_000;

// Earlier pages shown, kept for the session so Back from a title returns to
// the same place (DS 5.1). Filters don't close them. Read only after the
// first hydration, so the server's render always matches.
let hydrated = false;
const PAGES_KEY = "home-pages";

function restoredPages(): number {
  if (!hydrated) return 0;
  try {
    return Math.max(0, Number(sessionStorage.getItem(PAGES_KEY)) || 0);
  } catch {
    return 0;
  }
}

/** Marks Home viewed after 10 seconds, or when you leave it (PRD F16.3, as F5.5). */
function useMarkHomeViewed() {
  useEffect(() => {
    let done = false;
    const mark = () => {
      if (done) return;
      done = true;
      fetch("/api/home/viewed", { method: "POST", keepalive: true }).catch(() => {
        // Offline: Home is marked next time.
      });
    };
    const onHidden = () => document.visibilityState === "hidden" && mark();
    const timer = window.setTimeout(mark, VIEW_AFTER_MS);
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("pagehide", mark);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("pagehide", mark);
      mark();
    };
  }, []);
}

/** home_caught_up (PRD 11.2): once the marker has been seen, sent on leaving with the pages tapped. */
function useCaughtUpEvent(newCount: number, pages: number) {
  const ref = useRef<HTMLDivElement>(null);
  const state = useRef({ seen: false, newCount, pages });
  useEffect(() => {
    state.current.newCount = newCount;
    state.current.pages = pages;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) state.current.seen = true;
    });
    observer.observe(el);
    let sent = false;
    const send = () => {
      if (sent || !state.current.seen) return;
      sent = true;
      track("home_caught_up", { new_count: state.current.newCount, earlier_loaded: state.current.pages });
    };
    window.addEventListener("pagehide", send);
    return () => {
      observer.disconnect();
      window.removeEventListener("pagehide", send);
      send();
    };
  }, []);
  return ref;
}

type Item = { kind: "card"; card: ListCard; at: number } | { kind: "rollup"; rollup: ImportRollup; at: number };

const cardTime = (card: ListCard) => (card.latestAt ?? card.goodWords[0]?.at ?? new Date(0)).getTime();

/** Cards in their order, with roll-up lines slotted in at their time. */
function interleave(cards: ListCard[], rollups: ImportRollup[]): Item[] {
  const items: Item[] = cards.map((card) => ({ kind: "card", card, at: cardTime(card) }));
  for (const rollup of rollups) {
    const at = new Date(rollup.at).getTime();
    const i = items.findIndex((item) => item.at < at);
    items.splice(i === -1 ? items.length : i, 0, { kind: "rollup", rollup, at });
  }
  return items;
}

/** One Home card with its own vouch button (DS 4.2.2 home). */
function HomeCard({ card, serverMine, group }: { card: ListCard; serverMine: MyGoodWord | null; group?: Group }) {
  const { viewer, friends, mineFor, takeBack } = useGoodWords();
  const { openAdd, openEditNote, openChangeGroups } = useAdd();
  const { title } = card;
  const mine = mineFor(title.id, serverMine);
  const titleHref = `/title/${title.type}/${title.tmdbId}`;
  const conversationGroup = card.latestComment?.groupId ?? card.viaGroupId;
  return (
    <RecCardHome
      card={card}
      viewerId={viewer.id}
      href={titleHref}
      conversationHref={`${titleHref}/conversation${conversationGroup ? `?group=${conversationGroup}` : ""}`}
      whereToWatchHref={`${titleHref}#where-to-watch`}
      group={group}
      vouchButton={
        <VouchButton
          vouched={mine !== null}
          size="md"
          emphasis="secondary"
          putLabel={t("vouch.vouchToo")}
          titleName={title.name}
          onPut={() => openAdd({ title, entryPoint: "home_card" })}
          onEditNote={() => mine && openEditNote(title, mine)}
          onChangeGroups={() => mine && openChangeGroups(title, mine)}
          onTakeBack={() => mine && takeBack(title, mine)}
          withFriends={friends !== null}
        />
      }
    />
  );
}

export function HomeScreen({
  groups,
  cards: serverCards,
  services,
  rollups,
  mine: serverMine,
  friendIds,
  link,
  hasPeople,
}: {
  groups: SwitcherGroup[];
  cards: ListCard[];
  services: Service[];
  rollups: ImportRollup[];
  /** Your own good words on these titles, by title id. */
  mine: Record<string, MyGoodWord>;
  friendIds: string[];
  /** Your friend link, for the empty states. */
  link: string | null;
  /** You have a friend or a group. */
  hasPeople: boolean;
}) {
  const { overlays, viewer, groups: myGroups, myServices } = useGoodWords();
  const { openAdd } = useAdd();
  useMarkHomeViewed();

  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Home has no sort: always newest first (DS 5.19).
  const filters = useMemo(() => ({ ...parseFilters(searchParams), sort: "newest" as const, myServices }), [searchParams, myServices]);
  const filtered = isFiltered(filters);

  const cards = applyOverlays(serverCards, overlays, { kind: "home" }, viewer);
  const { cards: shown, unknownLength } = filterList(cards, filters);
  const fresh = shown.filter((c) => c.isNew);
  const earlier = shown.filter((c) => !c.isNew);
  // Roll-ups are about people, not titles: filters leave them out.
  const lines = filtered ? [] : rollups;

  const [pages, setPages] = useState(restoredPages);
  useEffect(() => {
    hydrated = true;
    try {
      sessionStorage.setItem(PAGES_KEY, String(pages));
    } catch {
      // Private mode: pages just aren't remembered.
    }
  }, [pages]);

  const earlierShown = earlier.slice(0, pages * PAGE_SIZE);
  const hasMore = earlierShown.length < earlier.length;
  const [announce, setAnnounce] = useState("");
  const showEarlier = () => {
    const count = Math.min(PAGE_SIZE, earlier.length - earlierShown.length);
    setPages((p) => p + 1);
    setAnnounce(t("home.earlierLoaded", { count }));
  };

  // Earlier roll-ups show once the cards around their time have loaded.
  const oldestShown = earlierShown.at(-1);
  const freshLines = lines.filter((r) => r.isNew);
  const earlierLines = lines.filter(
    (r) => !r.isNew && pages > 0 && (!hasMore || (oldestShown && new Date(r.at).getTime() >= cardTime(oldestShown))),
  );

  const caughtUpRef = useCaughtUpEvent(fresh.length, pages);
  const { ref: stuckRef, stuck } = useStuck();
  const groupOf = new Map(myGroups.map((g) => [g.id, g]));

  const onChange: FilterChange = (next, history) => {
    const url = `${pathname}${filtersToQuery(next)}`;
    if (history === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  };

  const putButton = (
    <Button variant="primary" size="lg" icon="add" onClick={() => openAdd({ entryPoint: "empty_state" })}>
      {t("vouch.put")}
    </Button>
  );

  const renderItems = (items: Item[]) =>
    items.map((item) =>
      item.kind === "rollup" ? (
        <li key={`rollup-${item.rollup.importId}`}>
          <ImportRollupLine person={item.rollup.person} count={item.rollup.count} at={new Date(item.rollup.at)} />
        </li>
      ) : (
        <li key={item.card.title.id}>
          <HomeCard card={item.card} serverMine={serverMine[item.card.title.id] ?? null} group={item.card.viaGroupId ? groupOf.get(item.card.viaGroupId) : undefined} />
        </li>
      ),
    );

  const bar: ReactNode = (
    <>
      <ListBar groups={groups} currentId="home" />
      <LiveList groupIds={groups.map((g) => g.id)} friendIds={friendIds} home />
      <h1 className="sr-only">{t("home.title")}</h1>
    </>
  );

  // Empty: nothing from anyone yet (PRD F16.3 states).
  if (cards.length === 0 && rollups.length === 0) {
    return (
      <>
        {bar}
        <ListMilestone />
        {hasPeople ? (
          <>
            <EmptyState headingLevel={2} title={t("home.emptyNothingTitle")} body={t("home.emptyNothingBody")} />
            {link && <FriendLinkCard me={viewer} link={link} />}
          </>
        ) : (
          <>
            <EmptyState showList headingLevel={2} title={t("home.emptyStartTitle")} body={t("home.emptyStartBody")} action={putButton} />
            {link && <FriendLinkCard me={viewer} link={link} shareVariant="secondary" />}
          </>
        )}
      </>
    );
  }

  const nothingNew = fresh.length === 0 && freshLines.length === 0;

  return (
    <>
      {bar}
      <ListMilestone />
      <div ref={stuckRef} aria-hidden="true" className="-mb-6 h-px" />
      <FilterBar
        filters={filters}
        stuck={stuck}
        sortable={false}
        resultCount={shown.length}
        onChange={onChange}
        options={{
          services: serviceCounts(cards, services, filters),
          genres: genreCounts(cards, filters),
          hasMyServices: myServices.length > 0,
        }}
      />
      {shown.length === 0 && filtered ? (
        <NoResults
          filters={filters}
          services={services}
          mine={false}
          unknownLength={unknownLength}
          onClear={() => onChange(clearFilters(filters), "replace")}
        />
      ) : (
        <div className="flex flex-col">
          {!nothingNew && (
            <section aria-label={t("home.newCards")}>
              <ul className="flex flex-col">{renderItems(interleave(fresh, freshLines))}</ul>
            </section>
          )}
          <div ref={caughtUpRef}>
            <CaughtUpMarker onEarlier={pages === 0 && earlier.length > 0 ? showEarlier : undefined}>
              {nothingNew && !filtered && putButton}
            </CaughtUpMarker>
          </div>
          {pages > 0 && (
            <section aria-label={t("home.earlierCards")} className="flex flex-col gap-8">
              <ul className="flex flex-col">
                {renderItems(interleave(earlierShown, earlierLines))}
              </ul>
              {hasMore && (
                <div className="flex justify-center">
                  <Button variant="ghost" onClick={showEarlier}>
                    {t("home.earlier")}
                  </Button>
                </div>
              )}
            </section>
          )}
          {!hasMore && (pages > 0 || earlier.length === 0) && <p className="pt-2 text-center text-caption text-muted">{t("home.end")}</p>}
        </div>
      )}
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
    </>
  );
}
