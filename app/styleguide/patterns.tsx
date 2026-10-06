"use client";

import { useState } from "react";
import { ActivityItem } from "@/components/domain/activity-item";
import { CommentSkeletons, NewCommentsPill } from "@/components/domain/comment";
import { ConfirmGoodWord } from "@/components/domain/confirm-good-word";
import {
  ConversationPreviewError,
  ConversationPreviewSection,
  ConversationPreviewSkeleton,
} from "@/components/domain/conversation-preview";
import { FilterBar } from "@/components/domain/filter-bar";
import { JoinPromptCard } from "@/components/domain/join-prompt-card";
import { RecCardGrid } from "@/components/domain/rec-card";
import type { ListCard } from "@/components/domain/types";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Milestone } from "@/components/ui/milestone";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { ToastView } from "@/components/ui/toast";
import { DEFAULT_FILTERS, filterList, genreCounts, serviceCounts, type Filters } from "@/lib/good-words/filters";
import { t } from "@/lib/messages";
import type { ConversationPreview } from "@/lib/conversations/types";
import { comments, goodWords, groups, groupsWithCounts, NOW, people, titles, viewer } from "./fixtures";
import { Component, Frame, Note, Section, Specimen, SpecimenGrid } from "./parts";

// Patterns (DS 14), added step by step. Step 4: putting in a good word (5.4)
// and the three lists in every state (PRD F5.7, DS 5.12). Step 5:
// browsing and filtering (5.6). Step 6: conversations, mentions, and Activity
// (5.17). Built from the same components the app uses.

const GRID = "grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4";

function SheetFrame({ label, title, children, footer }: { label: string; title: string; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <Frame label={label}>
      <div className="flex flex-col bg-surface-raised">
        <p className="px-5 pt-5 pb-3 text-title-m text-default">{title}</p>
        <div className="px-5 pb-5">{children}</div>
        <div className="border-t border-subtle px-5 py-3">{footer}</div>
      </div>
    </Frame>
  );
}

function PuttingIn() {
  const [note, setNote] = useState("");
  const [picked, setPicked] = useState(true);
  const chosen = picked ? groupsWithCounts.slice(0, 2) : [];
  return (
    <Component id="log-flow" title="Putting in a good word" spec="5.4">
      <SpecimenGrid>
        <Specimen label="Confirm step: optional note, visibility line defaulting to all your groups">
          <SheetFrame
            label="Tap the line to toggle between 2 groups and none"
            title={t("vouch.put")}
            footer={
              <Button variant="primary" size="lg" icon="add" fullWidth>
                {t("vouch.put")}
              </Button>
            }
          >
            <ConfirmGoodWord
              title={titles.nightFerry}
              note={note}
              onNoteChange={setNote}
              groups={chosen}
              peopleCount={picked ? 7 : 0}
              onChangeGroups={() => setPicked((p) => !p)}
            />
          </SheetFrame>
        </Specimen>
        <Specimen label="Already on every list picked: Edit note instead">
          <SheetFrame
            label="Already vouched"
            title={t("vouch.put")}
            footer={
              <Button variant="primary" size="lg" icon="edit" fullWidth>
                {t("vouch.editNote")}
              </Button>
            }
          >
            <ConfirmGoodWord
              title={titles.lowTide}
              note=""
              onNoteChange={() => {}}
              already
              groups={groupsWithCounts.slice(0, 1)}
              peopleCount={6}
              onChangeGroups={() => {}}
            />
          </SheetFrame>
        </Specimen>
        <Specimen label="Toasts: the audience named, nobody to see it yet, taken back, and a failed write">
          <div className="flex flex-col items-start gap-3">
            <ToastView
              message={t("vouch.onListAudience", { names: "Priya, Jonah, and 4 others" })}
              action={{ label: t("common.undo"), onAction: () => {} }}
            />
            <ToastView message={t("vouch.onListInvite")} action={{ label: t("vouch.invite"), onAction: () => {} }} />
            <ToastView message={t("vouch.takenBack")} action={{ label: t("common.undo"), onAction: () => {} }} />
            <ToastView message={t("vouch.didntSave")} action={{ label: t("common.retry"), onAction: () => {} }} />
          </div>
        </Specimen>
      </SpecimenGrid>
      <Note>
        In the app, the group picker, Edit note, and Change groups replace this sheet&apos;s content rather than stacking a
        second sheet. Picking groups uses the Group picker above.
      </Note>
    </Component>
  );
}

function Lists() {
  return (
    <Component id="list-states" title="Lists" spec="5.12">
      <Frame label="Ideal: a group list, one card per title, newest first (2, 3, then 4 columns); New since your last visit">
        <div className="p-4">
          <ul className={GRID}>
            {(["nightFerry", "lowTide", "heist"] as const).map((key) => (
              <li key={key}>
                <RecCardGrid title={titles[key]} goodWords={goodWords[key]} href="#list-states" viewerId={viewer.id} isNew={key === "nightFerry"} />
              </li>
            ))}
            <li>
              <RecCardGrid title={titles.moth} goodWords={[{ person: people.bea, at: new Date("2026-09-20T18:00:00Z") }]} href="#list-states" viewerId={viewer.id} />
            </li>
          </ul>
        </div>
      </Frame>
      <Frame label="My list: each card says where it's shared (Friends, with home_enabled), or Only you">
        <div className="p-4">
          <ul className={GRID}>
            <li>
              <RecCardGrid
                title={titles.nightFerry}
                goodWords={[{ person: viewer, note: "ep 3 is where it gets you", at: new Date("2026-09-27T18:00:00Z") }]}
                href="#list-states"
                viewerId={viewer.id}
                lists={[groups.college, groups.girls]}
              />
            </li>
            <li>
              <RecCardGrid
                title={titles.moth}
                goodWords={[{ person: viewer, at: new Date("2026-09-26T18:00:00Z") }]}
                href="#list-states"
                viewerId={viewer.id}
                lists={[]}
              />
            </li>
            <li>
              <RecCardGrid
                title={titles.lowTide}
                goodWords={[{ person: viewer, note: "the lighthouse scene", at: new Date("2026-09-25T18:00:00Z") }]}
                href="#list-states"
                viewerId={viewer.id}
                lists={[groups.book]}
                friends
              />
            </li>
          </ul>
        </div>
      </Frame>
      <SpecimenGrid>
        <Specimen label="Milestone, above the grid, once (the 10th; the first is under Primitives)">
          <Milestone line={t("milestone.tenthLine")} body={t("milestone.tenthBody")} onDismiss={() => {}} />
        </Specimen>
        <Specimen label="First-good-word prompt, after the last card">
          <JoinPromptCard onPut={() => {}} onDismiss={() => {}} />
        </Specimen>
        <Specimen label="Offline: a banner; what's loaded stays">
          <Banner icon="offline">{t("list.offline")}</Banner>
        </Specimen>
      </SpecimenGrid>
      <SpecimenGrid>
        <Specimen label="Empty group list">
          <EmptyState
            showList
            headingLevel={4}
            title={t("list.groupEmptyTitle")}
            body={t("list.groupEmptyBody")}
            action={
              <div className="flex flex-wrap gap-3 md:justify-center">
                <Button variant="primary" icon="add">
                  {t("vouch.put")}
                </Button>
                <Button variant="secondary" icon="share">
                  {t("list.inviteFriends")}
                </Button>
              </div>
            }
          />
        </Specimen>
        <Specimen label="No groups yet">
          <EmptyState
            showList
            headingLevel={4}
            title={t("list.noGroupsTitle")}
            body={t("list.noGroupsBody")}
            action={
              <div className="flex flex-col items-start gap-4 md:items-center">
                <div className="flex flex-wrap gap-3 md:justify-center">
                  <ButtonLink href="#list-states" variant="primary" icon="add">
                    {t("list.startGroup")}
                  </ButtonLink>
                  <Button variant="secondary">{t("vouch.put")}</Button>
                </div>
                <p className="text-caption text-muted">{t("list.inviteHint")}</p>
              </div>
            }
          />
        </Specimen>
        <Specimen label="Empty My list">
          <EmptyState
            showList
            headingLevel={4}
            title={t("you.emptyTitle")}
            body={t("you.emptyBody")}
            action={
              <Button variant="primary" icon="add">
                {t("vouch.put")}
              </Button>
            }
          />
        </Specimen>
        <Specimen label="Error, with Retry">
          <ErrorState
            headingLevel={4}
            title={t("list.errorTitle")}
            body={t("list.errorBody")}
            action={<Button variant="secondary">{t("common.retry")}</Button>}
          />
        </Specimen>
        <Specimen label="Loading: skeletons in the grid's shape" wide>
          <SkeletonRegion label={t("list.loading")} className="w-full">
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col gap-2.5">
                  <Skeleton className="aspect-2/3 w-full rounded-poster" />
                  <Skeleton className="h-4 w-3/4 rounded-control" />
                  <Skeleton className="h-3 w-1/3 rounded-control" />
                  <Skeleton className="h-6 w-1/2 rounded-pill" />
                </div>
              ))}
            </div>
          </SkeletonRegion>
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

const listServices = [
  { id: 8, name: "Netflix" },
  { id: 15, name: "Hulu" },
  { id: 337, name: "Disney Plus" },
];

const listCards: ListCard[] = [
  { title: titles.nightFerry, goodWords: goodWords.nightFerry, services: [8], isNew: true },
  { title: titles.lowTide, goodWords: goodWords.lowTide, services: [8, 15] },
  { title: titles.heist, goodWords: goodWords.heist, services: [15] },
  { title: titles.moth, goodWords: [{ person: people.bea, at: new Date("2026-09-20T18:00:00Z") }], services: [337] },
];

function Browsing() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const { cards } = filterList(listCards, filters);
  return (
    <Component id="browsing" title="Browsing and filtering the list" spec="5.6">
      <Frame label="Live: All / Movies / Shows, service chips with counts, More filters, sort. Active filters stay visible with a count and Clear">
        <div className="flex flex-col gap-6 px-4 pb-4">
          <FilterBar
            filters={filters}
            resultCount={cards.length}
            onChange={(next) => setFilters(next)}
            options={{ services: serviceCounts(listCards, listServices, filters), genres: genreCounts(listCards, filters) }}
          />
          {cards.length === 0 ? (
            <EmptyState
              headingLevel={4}
              title={t("filters.noResults", { subject: "a Netflix movie" })}
              body={t("filters.noResultsBody")}
              action={
                <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
                  {t("filters.clearFilters")}
                </Button>
              }
            />
          ) : (
            <div className="flex flex-col gap-10">
              <ul className={GRID}>
                {cards.map((card) => (
                  <li key={card.title.id}>
                    <RecCardGrid title={card.title} goodWords={card.goodWords} href="#browsing" viewerId={viewer.id} isNew={card.isNew} />
                  </li>
                ))}
              </ul>
              <p className="text-center text-caption text-muted">{t("list.end")}</p>
            </div>
          )}
        </div>
      </Frame>
      <SpecimenGrid>
        <Specimen label="More than 24 cards: infinite scroll, with Load more as the fallback">
          <Button variant="secondary">{t("list.loadMore")}</Button>
        </Specimen>
        <Specimen label="No results, with a length filter on: says titles with unknown length are left out">
          <EmptyState
            headingLevel={4}
            title={t("filters.noResultsAny")}
            body={t("filters.unknownLength")}
            action={<Button variant="secondary">{t("filters.clearFilters")}</Button>}
          />
        </Specimen>
        <Specimen label="No results on My list">
          <EmptyState
            headingLevel={4}
            title={t("filters.noResultsMine")}
            body={t("filters.noResultsBody")}
            action={<Button variant="secondary">{t("filters.clearFilters")}</Button>}
          />
        </Specimen>
      </SpecimenGrid>
      <Note>In the app, every filter lives in the URL: the segmented control adds a history entry, chips and sort replace it (PRD 6.3).</Note>
    </Component>
  );
}

const previews: ConversationPreview[] = [
  {
    group: groupsWithCounts[0],
    count: 12,
    latestAt: comments[4].at,
    onList: true,
    recent: comments.slice(2).map((c) => ({ ...c, covered: Boolean(c.spoiler) && c.author.id !== viewer.id })),
  },
  { group: groupsWithCounts[1], count: 0, onList: false, recent: [] },
];

function Conversations() {
  return (
    <Component id="conversations" title="Conversations, mentions, and Activity" spec="5.17">
      <SpecimenGrid>
        <Specimen label="Title detail preview: any title, in any of your groups; spoilers are never previewed">
          <ConversationPreviewSection
            title={titles.nightFerry}
            previews={previews}
            selectedId={groups.college.id}
            viewerId={viewer.id}
            pathname="/styleguide"
            headingLevel={4}
            now={NOW}
          />
        </Specimen>
        <Specimen label="Preview, nothing said yet in this group">
          <ConversationPreviewSection
            title={titles.nightFerry}
            previews={previews}
            selectedId={groups.girls.id}
            viewerId={viewer.id}
            pathname="/styleguide"
            headingLevel={4}
            now={NOW}
          />
        </Specimen>
        <Specimen label="Preview loading, and didn't load (only its region)">
          <div className="flex flex-col gap-8">
            <ConversationPreviewSkeleton />
            <ConversationPreviewError headingLevel={4} />
          </div>
        </Specimen>
      </SpecimenGrid>
      <SpecimenGrid>
        <Specimen label="Conversation, empty: tapping it focuses the composer">
          <p className="rounded-card px-4 py-8 text-center text-body text-muted">{t("conversation.empty")}</p>
        </Specimen>
        <Specimen label="Conversation loading: 4 skeleton comments">
          <CommentSkeletons />
        </Specimen>
        <Specimen label="Conversation didn't load: the composer and draft stay usable">
          <ErrorState
            headingLevel={4}
            title={t("conversation.errorTitle")}
            body={t("conversation.errorBody")}
            action={<Button variant="secondary">{t("common.retry")}</Button>}
          />
        </Specimen>
        <Specimen label="New comments arrived while scrolled up">
          <div className="flex justify-center">
            <NewCommentsPill count={2} onJump={() => {}} />
          </div>
        </Specimen>
        <Specimen label="One-time hint, the first time someone comments on a series">
          <p className="text-caption text-muted">{t("conversation.spoilerHint")}</p>
        </Specimen>
        <Specimen label="Offline: what's loaded stays; a comment that can't send says so, with Retry">
          <Banner icon="offline">{t("list.offline")}</Banner>
        </Specimen>
      </SpecimenGrid>
      <Frame label="Activity: Today, This week, Earlier; Mark all as read while anything is unread">
        <div className="flex flex-col gap-4 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-title-m text-default">{t("activityScreen.title")}</p>
            <Button variant="secondary" size="sm">
              {t("activityScreen.markAllRead")}
            </Button>
          </div>
          <p className="text-overline text-muted uppercase">{t("activityScreen.today")}</p>
          <ul className="-mx-4 border-t border-subtle">
            <li>
              <ActivityItem kind="mention" actor={people.priya} title={titles.nightFerry} group={groups.college} quote="@Tess you have to get to ep 6 before we talk" at={new Date(NOW.getTime() - 7_200_000)} unread href="#conversations" now={NOW} />
            </li>
            <li>
              <ActivityItem kind="comment" actor={people.mo} actorNames="Mo and Jonah" title={titles.nightFerry} group={groups.college} spoiler at={new Date(NOW.getTime() - 2_400_000 * 3)} href="#conversations" now={NOW} />
            </li>
          </ul>
        </div>
      </Frame>
      <SpecimenGrid>
        <Specimen label="Activity, empty">
          <EmptyState headingLevel={4} title={t("activityScreen.emptyTitle")} body={t("activityScreen.emptyBody")} />
        </Specimen>
        <Specimen label="Activity loading: 5 skeleton rows">
          <SkeletonRegion label={t("activityScreen.loading")} className="flex flex-col">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-start gap-3 border-b border-subtle py-3">
                <Skeleton className="size-10 rounded-pill" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-3/4 rounded-control" />
                  <Skeleton className="h-3 w-1/2 rounded-control" />
                </div>
              </div>
            ))}
          </SkeletonRegion>
        </Specimen>
        <Specimen label="Activity didn't load">
          <ErrorState
            headingLevel={4}
            title={t("activityScreen.errorTitle")}
            body={t("activityScreen.errorBody")}
            action={<Button variant="secondary">{t("common.retry")}</Button>}
          />
        </Specimen>
      </SpecimenGrid>
      <Note>
        In the app: the full conversation is its own screen below 1024px (no tab bar, the composer above the keyboard),
        and a panel beside title detail from 1024px. New comments from others arrive live; Activity&apos;s bell updates
        within seconds.
      </Note>
    </Component>
  );
}

export function Patterns() {
  return (
    <Section
      id="patterns"
      title="Patterns"
      intro="Section 5 patterns, added as each build step builds them. Step 4: putting in a good word and the lists. Step 5: browsing and filtering. Step 6: conversations and Activity."
    >
      <PuttingIn />
      <Lists />
      <Browsing />
      <Conversations />
    </Section>
  );
}
