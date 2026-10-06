"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FilterBar, type FilterChange } from "@/components/domain/filter-bar";
import { RecCardGrid } from "@/components/domain/rec-card";
import type { Service, ListCard } from "@/components/domain/types";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Milestone } from "@/components/ui/milestone";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import {
  article,
  clearFilters,
  filterList,
  filtersToQuery,
  genreCounts,
  noResultsSubject,
  PAGE_SIZE,
  parseFilters,
  serviceCounts,
  type Filters,
} from "@/lib/good-words/filters";
import { applyOverlays, type ListScope } from "@/lib/good-words/list";
import { t } from "@/lib/messages";
import { useGoodWords } from "../good-words";

// A list's cards (PRD F5, DS 4.2.2, 5.6): the filter bar, then a grid of 2,
// 3, then 4 columns (DS 8.1), with the viewer's pending changes applied. A
// card the viewer just put in slides in at the top. Filters and sort live in
// the URL (PRD 6.3), so they survive refresh and Back; the whole list is
// loaded, so filtering is instant and works offline. Cards show 24 at a
// time, with infinite scroll, a Load more fallback, and an end footer.

const GRID = "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4";

// Pages shown per list and filter, kept for the session, so Back from a
// title returns to the same place (DS 5.1). Read only after the first
// hydration, so the server's first page always matches.
let hydrated = false;
const pagesKey = (key: string) => `list-pages:${key}`;

function restoredPages(key: string): number {
  if (!hydrated) return 1;
  try {
    return Math.max(1, Number(sessionStorage.getItem(pagesKey(key))) || 1);
  } catch {
    return 1;
  }
}

/** Shows the next page when the end of the grid comes near. */
function useInfiniteScroll(onMore: (() => void) | null) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !onMore) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && onMore(), {
      rootMargin: "600px 0px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [onMore]);
  return ref;
}

/** Whether the filter bar is stuck under the top of the screen (its hairline shows). */
function useStuck() {
  const ref = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setStuck(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, stuck };
}

export function ListCards({
  cards: serverCards,
  services,
  scope,
  empty,
  after,
}: {
  cards: ListCard[];
  /** Streaming services on the list in the viewer's region. */
  services: Service[];
  scope: ListScope;
  /** The empty state, when there's nothing on the list. */
  empty: ReactNode;
  /** Below the cards: the first-good-word prompt. */
  after?: ReactNode;
}) {
  const { overlays, viewer, groups, myServices } = useGoodWords();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = useMemo(() => ({ ...parseFilters(searchParams), myServices }), [searchParams, myServices]);
  const query = filtersToQuery(filters);
  const key = `${pathname}${query}`;

  const cards = applyOverlays(serverCards, overlays, scope, viewer);
  const { cards: shown, unknownLength } = filterList(cards, filters);
  const onServer = new Set(serverCards.map((c) => c.title.id));
  const groupOf = new Map(groups.map((g) => [g.id, { id: g.id, name: g.name }]));

  const [paging, setPaging] = useState(() => ({ key, pages: restoredPages(key) }));
  let pages = paging.pages;
  if (paging.key !== key) {
    // Filters changed: back to the first page.
    pages = 1;
    setPaging({ key, pages });
  }
  useEffect(() => {
    hydrated = true;
    try {
      sessionStorage.setItem(pagesKey(paging.key), String(paging.pages));
    } catch {
      // Private mode: pages just aren't remembered.
    }
  }, [paging]);

  const visible = shown.slice(0, pages * PAGE_SIZE);
  const hasMore = visible.length < shown.length;
  const [loadMore] = useState(() => () => setPaging((p) => ({ ...p, pages: p.pages + 1 })));
  const sentinel = useInfiniteScroll(hasMore ? loadMore : null);
  const { ref: stuckRef, stuck } = useStuck();

  const onChange: FilterChange = (next, history) => {
    const url = `${pathname}${filtersToQuery(next)}`;
    if (history === "push") window.history.pushState(null, "", url);
    else window.history.replaceState(null, "", url);
  };

  if (cards.length === 0) {
    return (
      <>
        <ListMilestone />
        {empty}
      </>
    );
  }

  return (
    <>
      <ListMilestone />
      <div ref={stuckRef} aria-hidden="true" className="-mb-8 h-px" />
      <FilterBar
        filters={filters}
        stuck={stuck}
        resultCount={shown.length}
        onChange={onChange}
        options={{
          services: serviceCounts(cards, services, filters),
          genres: genreCounts(cards, filters),
          hasMyServices: myServices.length > 0,
          ...(scope.kind === "mine" ? { groups: groups.map(({ id, name }) => ({ id, name })) } : {}),
        }}
      />
      {shown.length === 0 ? (
        <NoResults
          filters={filters}
          services={services}
          mine={scope.kind === "mine"}
          unknownLength={unknownLength}
          onClear={() => onChange(clearFilters(filters), "replace")}
        />
      ) : (
        <section aria-label={t("list.goodWords", { count: shown.length })} className="flex flex-col gap-10">
          <ul className={GRID}>
            {visible.map((card, i) => (
              <li key={card.title.id} className={onServer.has(card.title.id) ? undefined : "motion-ok:animate-card-in"}>
                <RecCardGrid
                  title={card.title}
                  goodWords={card.goodWords}
                  viewerId={viewer.id}
                  href={`/title/${card.title.type}/${card.title.tmdbId}${scope.kind === "group" ? `?group=${scope.groupId}` : ""}`}
                  isNew={card.isNew}
                  commentCount={card.comments?.count}
                  unseenComments={card.comments?.unseen}
                  eager={i < 4}
                  lists={
                    scope.kind === "mine"
                      ? (card.groupIds ?? []).flatMap((id) => {
                          const group = groupOf.get(id);
                          return group ? [group] : [];
                        })
                      : undefined
                  }
                  friends={scope.kind === "mine" && card.friends}
                />
              </li>
            ))}
          </ul>
          {after}
          {hasMore ? (
            <div ref={sentinel} className="flex justify-center">
              <Button variant="secondary" onClick={loadMore}>
                {t("list.loadMore")}
              </Button>
            </div>
          ) : (
            <p className="text-center text-caption text-muted">{t("list.end")}</p>
          )}
        </section>
      )}
    </>
  );
}

function NoResults({
  filters,
  services,
  mine,
  unknownLength,
  onClear,
}: {
  filters: Filters;
  services: Service[];
  mine: boolean;
  unknownLength: number;
  onClear: () => void;
}) {
  const subject = noResultsSubject(filters, (id) => services.find((s) => s.id === id)?.name, {
    movie: t("filters.movie"),
    tv: t("filters.show"),
    anythingOn: (names) => t("filters.anythingOn", { services: names }),
    a: (noun) => t(article(noun) === "an" ? "filters.anNoun" : "filters.aNoun", { noun }),
  });
  const title = mine
    ? t("filters.noResultsMine")
    : subject
      ? t("filters.noResults", { subject })
      : t("filters.noResultsAny");
  return (
    <EmptyState
      headingLevel={2}
      title={title}
      body={unknownLength > 0 ? t("filters.unknownLength") : t("filters.noResultsBody")}
      action={
        <Button variant="secondary" size="lg" onClick={onClear}>
          {t("filters.clearFilters")}
        </Button>
      }
    />
  );
}

export function ListMilestone() {
  const { milestone, dismissMilestone } = useGoodWords();
  if (!milestone) return null;
  return (
    <Milestone
      line={t(milestone === "first" ? "milestone.firstLine" : "milestone.tenthLine")}
      body={t(milestone === "first" ? "milestone.firstBody" : "milestone.tenthBody")}
      onDismiss={dismissMilestone}
    />
  );
}

/** Six skeleton cards in the grid's exact shape (PRD F5.7, DS 4.1.17). */
export function ListSkeleton() {
  return (
    <SkeletonRegion label={t("list.loading")}>
      <div className={GRID}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-col gap-2.5">
            <Skeleton className="aspect-2/3 w-full rounded-poster" />
            <Skeleton className="h-4 w-3/4 rounded-control" />
            <Skeleton className="h-3 w-1/3 rounded-control" />
            <Skeleton className="h-6 w-1/2 rounded-pill" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}
