"use client";

import { useState } from "react";
import { ConfirmGoodWord } from "@/components/domain/confirm-good-word";
import { JoinPromptCard } from "@/components/domain/join-prompt-card";
import { RecCardGrid } from "@/components/domain/rec-card";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Milestone } from "@/components/ui/milestone";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { ToastView } from "@/components/ui/toast";
import { t } from "@/lib/messages";
import { goodWords, groups, groupsWithCounts, people, titles, viewer } from "./fixtures";
import { Component, Frame, Note, Section, Specimen, SpecimenGrid } from "./parts";

// Patterns (DS 14), added step by step. Step 4: putting in a good word (5.4)
// and the three shelves in every state (PRD F5.7, DS 5.12), built from the
// same components the app uses.

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
        <Specimen label="Already on every shelf picked: Edit note instead">
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
              message={t("vouch.onShelfAudience", { names: "Priya, Jonah, and 4 others" })}
              action={{ label: t("common.undo"), onAction: () => {} }}
            />
            <ToastView message={t("vouch.onShelfInvite")} action={{ label: t("vouch.invite"), onAction: () => {} }} />
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

function Shelves() {
  return (
    <Component id="shelf-states" title="Shelves" spec="5.12">
      <Frame label="Ideal: a group shelf, one card per title, newest first (2, 3, then 4 columns)">
        <div className="p-4">
          <ul className={GRID}>
            {(["nightFerry", "lowTide", "heist"] as const).map((key) => (
              <li key={key}>
                <RecCardGrid title={titles[key]} goodWords={goodWords[key]} href="#shelf-states" viewerId={viewer.id} />
              </li>
            ))}
            <li>
              <RecCardGrid title={titles.moth} goodWords={[{ person: people.bea, at: new Date("2026-09-20T18:00:00Z") }]} href="#shelf-states" viewerId={viewer.id} />
            </li>
          </ul>
        </div>
      </Frame>
      <Frame label="My shelf: each card says where it's shared, or Only you">
        <div className="p-4">
          <ul className={GRID}>
            <li>
              <RecCardGrid
                title={titles.nightFerry}
                goodWords={[{ person: viewer, note: "ep 3 is where it gets you", at: new Date("2026-09-27T18:00:00Z") }]}
                href="#shelf-states"
                viewerId={viewer.id}
                shelves={[groups.college, groups.girls]}
              />
            </li>
            <li>
              <RecCardGrid
                title={titles.moth}
                goodWords={[{ person: viewer, at: new Date("2026-09-26T18:00:00Z") }]}
                href="#shelf-states"
                viewerId={viewer.id}
                shelves={[]}
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
          <Banner icon="offline">{t("shelf.offline")}</Banner>
        </Specimen>
      </SpecimenGrid>
      <SpecimenGrid>
        <Specimen label="Empty group shelf">
          <EmptyState
            showShelf
            headingLevel={4}
            title={t("shelf.groupEmptyTitle")}
            body={t("shelf.groupEmptyBody")}
            action={
              <div className="flex flex-wrap gap-3 md:justify-center">
                <Button variant="primary" icon="add">
                  {t("vouch.put")}
                </Button>
                <Button variant="secondary" icon="share">
                  {t("shelf.inviteFriends")}
                </Button>
              </div>
            }
          />
        </Specimen>
        <Specimen label="No groups yet">
          <EmptyState
            showShelf
            headingLevel={4}
            title={t("shelf.noGroupsTitle")}
            body={t("shelf.noGroupsBody")}
            action={
              <div className="flex flex-col items-start gap-4 md:items-center">
                <div className="flex flex-wrap gap-3 md:justify-center">
                  <ButtonLink href="#shelf-states" variant="primary" icon="add">
                    {t("shelf.startGroup")}
                  </ButtonLink>
                  <Button variant="secondary">{t("vouch.put")}</Button>
                </div>
                <p className="text-caption text-muted">{t("shelf.inviteHint")}</p>
              </div>
            }
          />
        </Specimen>
        <Specimen label="Empty My shelf">
          <EmptyState
            showShelf
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
            title={t("shelf.errorTitle")}
            body={t("shelf.errorBody")}
            action={<Button variant="secondary">{t("common.retry")}</Button>}
          />
        </Specimen>
        <Specimen label="Loading: skeletons in the grid's shape" wide>
          <SkeletonRegion label={t("shelf.loading")} className="w-full">
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
      <Note>
        Filters, sort, paging, and New badges are step 5, so the no-results state arrives with them.
      </Note>
    </Component>
  );
}

export function Patterns() {
  return (
    <Section
      id="patterns"
      title="Patterns"
      intro="Section 5 patterns, added as each build step builds them. Step 4: putting in a good word and the shelves."
    >
      <PuttingIn />
      <Shelves />
    </Section>
  );
}
