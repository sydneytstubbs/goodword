"use client";

import type { ReactNode } from "react";
import { RecCardGrid } from "@/components/domain/rec-card";
import type { ShelfCard } from "@/components/domain/types";
import { Milestone } from "@/components/ui/milestone";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { applyOverlays, type ShelfScope } from "@/lib/good-words/shelf";
import { t } from "@/lib/messages";
import { useGoodWords } from "../good-words";

// A shelf's cards (PRD F5, DS 4.2.2): a grid of 2, 3, then 4 columns (DS 8.1),
// newest good word first, with the viewer's pending changes applied. A card
// the viewer just put in slides in at the top. The milestone moment, when
// there is one, sits above the grid (DS 4.1.20).

const GRID = "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4";

export function ShelfCards({
  cards: serverCards,
  scope,
  empty,
  after,
}: {
  cards: ShelfCard[];
  scope: ShelfScope;
  /** The empty state, when there's nothing on the shelf. */
  empty: ReactNode;
  /** Below the last card: the first-good-word prompt. */
  after?: ReactNode;
}) {
  const { overlays, viewer, groups } = useGoodWords();
  const cards = applyOverlays(serverCards, overlays, scope, viewer);
  const onServer = new Set(serverCards.map((c) => c.title.id));
  const groupOf = new Map(groups.map((g) => [g.id, { id: g.id, name: g.name }]));

  return (
    <>
      <ShelfMilestone />
      {cards.length === 0 ? (
        empty
      ) : (
        <section aria-label={t("shelf.goodWords", { count: cards.length })} className="flex flex-col gap-10">
          <ul className={GRID}>
            {cards.map((card, i) => (
              <li key={card.title.id} className={onServer.has(card.title.id) ? undefined : "motion-ok:animate-card-in"}>
                <RecCardGrid
                  title={card.title}
                  goodWords={card.goodWords}
                  viewerId={viewer.id}
                  href={`/title/${card.title.type}/${card.title.tmdbId}`}
                  eager={i < 4}
                  shelves={
                    scope.kind === "mine"
                      ? (card.groupIds ?? []).flatMap((id) => {
                          const group = groupOf.get(id);
                          return group ? [group] : [];
                        })
                      : undefined
                  }
                />
              </li>
            ))}
          </ul>
          {after}
        </section>
      )}
    </>
  );
}

export function ShelfMilestone() {
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
export function ShelfSkeleton() {
  return (
    <SkeletonRegion label={t("shelf.loading")}>
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
