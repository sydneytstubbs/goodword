"use client";

import { nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Comment } from "../domain/comment";
import { Composer } from "../domain/composer";
import { Poster } from "../domain/poster";
import { RecCardGrid, RecCardRow } from "../domain/rec-card";
import { titleMeta } from "../domain/title-meta";
import type { CommentData, Title } from "../domain/types";
import { VisibilityLine } from "../domain/visibility-line";
import { Button } from "../ui/button";
import { AvatarStack } from "../ui/avatar";
import { FilterChip, GroupDot } from "../ui/chip";
import { Textarea } from "../ui/textarea";
import { goodWords, groups, members, NOW, people, titles, viewer } from "./content";

// Product vignettes for the marketing page, built from DS components (spec 7).
// They render inside inert containers with a text alternative, so none of
// their controls are reachable; handlers are no-ops.

const noop = () => {};

/** Hero phone (spec 6.2): a College crew shelf with four cards. */
export function HeroShelfScreen() {
  return (
    <div className="flex h-full flex-col">
      <div className="h-11" />
      <div className="flex h-topbar items-center justify-between px-5">
        <span className="inline-flex items-center gap-1 text-heading text-default">
          {groups.college.name}
          <Icon name="switcher" size={20} />
        </span>
        <span className="flex items-center gap-4 text-default">
          <Icon name="activity" size={24} />
          <Icon name="share" size={24} />
        </span>
      </div>
      <div className="flex flex-col gap-3 px-5 pt-1 pb-5">
        <p className="text-title-l text-default">{groups.college.name}</p>
        <div className="flex items-center gap-2">
          <AvatarStack people={members.college} size={24} />
          <span className="text-caption text-muted">{t("groups.members", { count: members.college.length })}</span>
        </div>
      </div>
      <div className="grid flex-1 grid-cols-2 gap-x-3 gap-y-6 overflow-hidden px-5">
        <RecCardGrid title={titles.nightFerry} goodWords={goodWords.nightFerry} href="#" isNew commentCount={12} viewerId={viewer.id} eager />
        <RecCardGrid title={titles.moth} goodWords={goodWords.moth} href="#" viewerId={viewer.id} eager />
        <RecCardGrid title={titles.lowTide} goodWords={goodWords.lowTide} href="#" viewerId={viewer.id} />
        <RecCardGrid title={titles.heist} goodWords={goodWords.heist} href="#" viewerId={viewer.id} />
      </div>
    </div>
  );
}

/** How it works 01 (spec 6.4): the confirm sheet (DS 5.4). */
export function ConfirmSheetVignette() {
  return (
    <div className="rounded-sheet border border-subtle bg-surface-raised p-5 shadow-lg md:p-6">
      <div aria-hidden="true" className="mx-auto mb-5 h-1 w-9 rounded-pill bg-subtle" />
      <div className="flex items-center gap-4">
        <Poster title={titles.nightFerry} size="activity" />
        <div className="flex flex-col gap-1">
          <p className="text-heading text-default">{titles.nightFerry.name}</p>
          <p className="text-caption text-muted">{titleMeta(titles.nightFerry)}</p>
        </div>
      </div>
      <Textarea
        className="mt-6"
        label={t("vouch.noteLabel")}
        optional
        value={t("vouch.notePlaceholder")}
        onValueChange={noop}
        minRows={2}
      />
      <div className="mt-4">
        <VisibilityLine
          groups={[
            { ...groups.college, memberCount: members.college.length },
            { ...groups.girls, memberCount: members.girls.length },
          ]}
          peopleCount={11}
        />
      </div>
      <Button variant="primary" size="lg" icon="add" fullWidth className="mt-4">
        {t("vouch.put")}
      </Button>
    </div>
  );
}

function MiniShelf({ group, tone, children }: { group: { id: string; name: string }; tone: 1 | 2 | 3 | 4; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-card border border-subtle bg-surface-raised p-4 shadow-sm">
      <p className="inline-flex items-center gap-2 text-heading text-default">
        <GroupDot group={group} tone={tone} />
        {group.name}
      </p>
      {children}
    </div>
  );
}

/** How it works 02 (spec 6.4): the same good word on two shelves. */
export function TwoShelvesVignette() {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4">
      <MiniShelf group={groups.college} tone={3}>
        <RecCardGrid title={titles.nightFerry} goodWords={goodWords.nightFerry} href="#" viewerId={viewer.id} />
      </MiniShelf>
      <MiniShelf group={groups.girls} tone={4}>
        <RecCardGrid title={titles.nightFerry} goodWords={[goodWords.nightFerry[0]]} href="#" viewerId={viewer.id} />
      </MiniShelf>
    </div>
  );
}

/** How it works 03 (spec 6.4): a filtered shelf, every pick with a name on it. */
export function FilteredShelfVignette() {
  const picks: Array<{ title: Title; words: typeof goodWords.heist }> = [
    { title: titles.heist, words: goodWords.heist },
    { title: titles.parking, words: goodWords.parking },
    { title: titles.salt, words: goodWords.salt },
  ];
  return (
    <div className="flex flex-col gap-4 rounded-card border border-subtle bg-surface-raised p-4 shadow-sm md:p-5">
      <div className="flex flex-wrap gap-2">
        <FilterChip label={t("marketing.how.filterComedy")} selected />
        <FilterChip label={t("marketing.how.filterLength")} selected />
        <FilterChip label={t("marketing.how.filterService")} selected />
      </div>
      <p className="text-caption text-muted">{t("marketing.how.filteredCount")}</p>
      <div>
        {picks.map(({ title, words }) => (
          <RecCardRow
            key={title.id}
            title={title}
            goodWords={words}
            href="#"
            viewerId={viewer.id}
            annotation={
              words.length > 1 ? (
                <span className="flex items-center gap-2">
                  <AvatarStack people={words.map((w) => w.person)} size={24} ring="surface-raised" />
                  <span className="text-caption text-muted">
                    {t("search.friendsVouched", { names: nameList(words.map((w) => w.person.name)) })}
                  </span>
                </span>
              ) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

/** Groups (spec 6.5): one shelf column. */
export function ShelfColumn({
  group,
  tone,
  people: groupMembers,
  shelf,
}: {
  group: { id: string; name: string };
  tone: 1 | 2 | 3 | 4;
  people: typeof members.college;
  shelf: Array<{ title: Title; caption?: string }>;
}) {
  return (
    <div className="flex flex-col gap-5 rounded-card border border-subtle bg-surface-raised p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <h3 className="inline-flex items-center gap-2 text-heading text-default">
          <GroupDot group={group} tone={tone} />
          {group.name}
        </h3>
        <AvatarStack people={groupMembers} size={24} ring="surface-raised" />
      </div>
      <ul className="flex flex-col gap-4">
        {shelf.map(({ title, caption }) => (
          <li key={title.id} className="flex items-center gap-4">
            <Poster title={title} size="activity" />
            <div className="flex flex-col gap-1">
              <p className="text-card-title text-default">{title.name}</p>
              <p className="text-caption text-muted">{titleMeta(title)}</p>
              {caption && <p className="text-caption text-muted">{caption}</p>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

const conversation: CommentData[] = [
  {
    id: "t1",
    author: people.tess,
    at: new Date(NOW.getTime() - 25 * 60_000),
    body: [
      { kind: "text", text: t("marketing.talk.tessComment") },
      { kind: "mention", userId: people.priya.id, name: people.priya.name },
      { kind: "text", text: t("marketing.talk.tessCommentEnd") },
    ],
  },
  // Covered, and never rendered: the mockup has no spoiler text at all.
  { id: "m1", author: people.mo, at: new Date(NOW.getTime() - 8 * 60_000), spoiler: true, body: [] },
];

/** Talk about it (spec 6.6): a conversation screen (DS 5.17). */
export function ConversationScreen() {
  return (
    <div className="flex h-full flex-col">
      <div className="h-11" />
      <div className="flex items-center gap-3 border-b border-subtle px-3 pb-3">
        <span className="grid size-target place-items-center text-default">
          <Icon name="back" size={24} />
        </span>
        <Poster title={titles.nightFerry} size="row" />
        <div className="flex flex-col">
          <p className="text-heading text-default">{titles.nightFerry.name}</p>
          <p className="text-caption text-muted">{groups.college.name}</p>
        </div>
      </div>
      <ol className="flex flex-1 flex-col gap-4 px-5 py-5">
        {conversation.map((comment) => (
          <li key={comment.id}>
            <Comment comment={comment} viewerId={viewer.id} members={members.college} now={NOW} onSave={noop} onDelete={noop} />
          </li>
        ))}
      </ol>
      <Composer
        group={{ ...groups.college, memberCount: members.college.length }}
        members={members.college}
        viewerId={viewer.id}
        draftKey="marketing-mockup"
        onSend={noop}
      />
    </div>
  );
}
