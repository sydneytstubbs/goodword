"use client";

import { useState } from "react";
import { ActivityItem } from "@/components/domain/activity-item";
import { Rail, TabBar, TopBar } from "@/components/domain/app-bars";
import { Comment, CommentList, NewCommentsDivider } from "@/components/domain/comment";
import { Composer } from "@/components/domain/composer";
import { GroupSwitcher } from "@/components/domain/group-switcher";
import { FriendLinkCard } from "@/components/domain/friend-link-card";
import { InviteCard } from "@/components/domain/invite-card";
import { PersonRow } from "@/components/domain/person-row";
import { Poster } from "@/components/domain/poster";
import { RecCardDetail, RecCardGrid, RecCardRow, VouchedByRow } from "@/components/domain/rec-card";
import { RobotGuessCard } from "@/components/domain/robot-guess-card";
import { SpoilerCover } from "@/components/domain/spoiler-cover";
import { TitleSearch } from "@/components/domain/title-search";
import type { CommentData } from "@/components/domain/types";
import { GroupPicker, VisibilityLine } from "@/components/domain/visibility-line";
import { VouchButton } from "@/components/domain/vouch-button";
import { WhereToWatchList, WhereToWatchSkeleton } from "@/components/domain/where-to-watch";
import { Wordmark } from "@/components/domain/wordmark";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { t } from "@/lib/messages";
import {
  NOW,
  comments as initialComments,
  fakeSearch,
  goodWords,
  groups,
  groupsWithCounts,
  members,
  people,
  providers,
  switcherGroups,
  titles,
  viewer,
} from "./fixtures";
import { Component, Frame, Note, Section, Specimen, SpecimenGrid } from "./parts";

function Posters() {
  return (
    <Component id="poster" title="Poster" spec="4.2.1">
      <SpecimenGrid>
        <Specimen label="Typographic fallback, tone from the first genre (plum, ochre, moss, clay)" wide>
          <div className="grid w-full grid-cols-2 gap-3 md:grid-cols-4">
            {Object.values(titles).map((title) => (
              <Poster key={title.id} title={title} alt={`${title.name} (${title.year})`} />
            ))}
          </div>
        </Specimen>
        <Specimen label="Row (48) and activity (64): first letter only">
          <Poster title={titles.nightFerry} size="row" />
          <Poster title={titles.lowTide} size="activity" />
        </Specimen>
        <Specimen label="Loading, and an image that fails (falls back)">
          <div className="w-36">
            <Poster title={titles.moth} loading />
          </div>
          <div className="w-36">
            <Poster title={{ ...titles.heist, posterUrl: "/styleguide-missing-poster.jpg" }} alt="Grandma's Heist (2022)" />
          </div>
        </Specimen>
      </SpecimenGrid>
      <Note>Real TMDB images arrive in step 3; the styleguide uses only fallbacks (no real posters).</Note>
    </Component>
  );
}

function VouchButtons() {
  const [vouched, setVouched] = useState(false);
  const { showToast } = useToast();
  const handlers = {
    onPut: () => {
      setVouched(true);
      showToast({ message: "On your list. Priya, Jonah, and 4 others will see it.", action: { label: "Undo", onAction: () => setVouched(false) } });
    },
    onEditNote: () => showToast({ message: "Edit note opens the confirm sheet (step 4)." }),
    onChangeGroups: () => showToast({ message: "Change groups opens the group picker (step 4)." }),
    onTakeBack: () => {
      setVouched(false);
      showToast({ message: "Taken back.", action: { label: "Undo", onAction: () => setVouched(true) } });
    },
  };
  return (
    <Component id="vouch-button" title="Vouch button" spec="4.2.3">
      <SpecimenGrid>
        <Specimen label="Live: tap to vouch; tap again for the menu">
          <VouchButton vouched={vouched} size="lg" emphasis="primary" {...handlers} />
        </Specimen>
        <Specimen label="Not vouched: primary (detail), secondary, and a row's (“Add” below 768px)">
          <VouchButton vouched={false} size="lg" emphasis="primary" {...handlers} />
          <VouchButton vouched={false} size="md" emphasis="secondary" {...handlers} />
          <VouchButton vouched={false} size="md" emphasis="secondary" titleName="The Night Ferry" {...handlers} />
        </Specimen>
        <Specimen label="Vouched: wash, Check, “Your good word”">
          <VouchButton vouched size="lg" {...handlers} />
          <VouchButton vouched size="md" {...handlers} />
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function RecCards() {
  const { showToast } = useToast();
  const handlers = {
    onPut: () => showToast({ message: "The confirm sheet arrives in step 4." }),
    onEditNote: () => {},
    onChangeGroups: () => {},
    onTakeBack: () => {},
  };
  return (
    <Component id="rec-card" title="Rec card" spec="4.2.2">
      <Specimen label="grid: New badge, comment count with unseen dot, vouched-by row, latest note" wide>
        <div className="grid w-full grid-cols-2 gap-x-3 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
          <RecCardGrid title={titles.nightFerry} goodWords={goodWords.nightFerry} href="#rec-card" isNew commentCount={12} unseenComments viewerId={viewer.id} />
          <RecCardGrid title={titles.lowTide} goodWords={goodWords.lowTide} href="#rec-card" commentCount={3} viewerId={viewer.id} />
          <RecCardGrid title={titles.heist} goodWords={goodWords.heist} href="#rec-card" viewerId={viewer.id} />
          <RecCardGrid title={titles.moth} goodWords={[{ person: people.bea, at: NOW }]} href="#rec-card" viewerId={viewer.id} />
        </div>
      </Specimen>
      <Specimen label="row: the vouch button is a separate target; it says “Add” below 768px" wide>
        <div className="w-full max-w-detail">
          <RecCardRow title={titles.nightFerry} goodWords={goodWords.nightFerry} href="#rec-card" viewerId={viewer.id} trailing={<VouchButton vouched={false} titleName={titles.nightFerry.name} {...handlers} />} />
          <RecCardRow title={titles.lowTide} goodWords={goodWords.lowTide} href="#rec-card" viewerId={viewer.id} trailing={<VouchButton vouched {...handlers} />} />
          <RecCardRow title={titles.moth} goodWords={[]} href="#rec-card" viewerId={viewer.id} trailing={<VouchButton vouched={false} titleName={titles.moth.name} {...handlers} />} />
        </div>
      </Specimen>
      <Specimen label="detail: friends first, each with your groups it's in; where to watch; the vouch button; the overview (title-l is its h1; shown lower here)" wide>
        <Frame>
          <div className="p-5 md:p-8">
            <RecCardDetail
              title={titles.nightFerry}
              goodWords={[
                { person: viewer, note: "the lighthouse episode", at: NOW, groups: [] },
                ...goodWords.nightFerry.map((g, i) => ({ ...g, groups: i === 0 ? [groups.college, groups.girls] : [groups.college] })),
              ]}
              viewerId={viewer.id}
              headingLevel={4}
              now={NOW}
              whereToWatch={<WhereToWatchList providers={providers} headingLevel={5} />}
              vouchButton={<VouchButton vouched size="lg" emphasis="primary" {...handlers} />}
              overview={
                <p className="max-w-reading text-body text-default">
                  A night ferry crosses the same stretch of water every evening, and its six regulars start to notice that one of them is keeping a secret.
                </p>
              }
            />
          </div>
        </Frame>
      </Specimen>
      <SpecimenGrid>
        <Specimen label="Where to watch: nothing in your region">
          <WhereToWatchList providers={{ stream: [], rent: [], buy: [], link: null }} headingLevel={4} />
        </Specimen>
        <Specimen label="Where to watch: loading">
          <div className="w-full">
            <WhereToWatchSkeleton />
          </div>
        </Specimen>
      </SpecimenGrid>
      <Specimen label="Vouched-by row, with your own good word as “You”">
        <VouchedByRow goodWords={[{ person: viewer, at: NOW }, ...goodWords.nightFerry]} viewerId={viewer.id} />
      </Specimen>
    </Component>
  );
}

function Search() {
  const { showToast } = useToast();
  return (
    <Component id="title-search" title="Title search" spec="4.2.4">
      <Specimen label="Live. Try “night”, “nite ferry”, “zzz” (no results), or “error”" wide>
        <div className="w-full max-w-120">
          <TitleSearch
            search={fakeSearch}
            onSelect={(title) => showToast({ message: `Picked ${title.name}.` })}
            recent={["night ferry", "moth"]}
            annotations={{ onYourList: [titles.lowTide.id], friends: { [titles.nightFerry.id]: [people.priya, people.jonah] } }}
          />
        </div>
      </Specimen>
    </Component>
  );
}

function Switcher() {
  const [current, setCurrent] = useState(groups.college.id);
  return (
    <Component id="group-switcher" title="Group switcher" spec="4.2.5">
      <Specimen label="Opens a sheet; All groups is an explicit choice; counts of new good words since your last visit">
        <GroupSwitcher
          groups={switcherGroups}
          currentId={current}
          hrefFor={(id) => `/list/${id}`}
          onSelect={setCurrent}
          newCounts={{ [groups.girls.id]: 3, [groups.book.id]: 1 }}
        />
      </Specimen>
    </Component>
  );
}

function Visibility() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(groupsWithCounts.map((g) => g.id));
  const chosen = groupsWithCounts.filter((g) => selected.includes(g.id));
  const people = new Set(
    chosen.flatMap((g) => (g.id === groups.college.id ? members.college : g.id === groups.girls.id ? members.girls : members.book).map((p) => p.id)),
  ).size;
  return (
    <Component id="visibility-line" title="Visibility line and group picker" spec="4.2.6">
      <SpecimenGrid>
        <Specimen label="Live: tap to change; updates as you pick">
          <VisibilityLine groups={chosen} peopleCount={people} onChange={() => setOpen(true)} />
        </Specimen>
        <Specimen label="One group, compact (composer)">
          <VisibilityLine groups={[groupsWithCounts[0]]} peopleCount={6} compact />
        </Specimen>
      </SpecimenGrid>
      <GroupPicker
        open={open}
        onClose={() => setOpen(false)}
        groups={groupsWithCounts}
        selectedIds={selected}
        onSelectedChange={setSelected}
        peopleCount={people}
      />
    </Component>
  );
}

function Invites() {
  return (
    <Component id="invite-card" title="Invite card" spec="4.2.7">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <InviteCard group={groups.college} members={members.college} link="https://goodword.app/join/k7x2p" inviterName="Priya" />
        <InviteCard group={groups.girls} members={members.girls} link="https://goodword.app/join/p3m9q" state="reset" inviterName="Bea" />
        <InviteCard group={groups.book} members={members.book} link="https://goodword.app/join/a1b2c" state="expired" inviterName="Jonah" />
      </div>
      <Note>Friend link variant (5.20): your name instead of a group, and Reset link in its menu.</Note>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <FriendLinkCard me={people.priya} link="https://goodword.app/join/f8w4r" onReset={() => {}} />
        <FriendLinkCard me={people.tess} link="https://goodword.app/join/n2v6t" justReset onReset={() => {}} />
      </div>
    </Component>
  );
}

function Bars() {
  const { showToast } = useToast();
  const add = () => showToast({ message: "Add opens the log sheet (step 4)." });
  return (
    <Component id="app-bars" title="App bars and navigation" spec="4.2.8">
      <SpecimenGrid>
        <Specimen label="Top bar, at the top of the page" wide>
          <Frame>
            <TopBar
              placement="inline"
              groupName="College crew"
              activityCount={3}
              onInvite={() => showToast({ message: "Invite opens the invite card." })}
              switcher={<GroupSwitcher groups={switcherGroups} currentId={groups.college.id} hrefFor={(id) => `/list/${id}`} onSelect={() => {}} />}
            />
          </Frame>
        </Specimen>
        <Specimen label="Top bar, content scrolled under it (hairline)" wide>
          <Frame>
            <TopBar
              placement="inline"
              scrolled
              groupName="The girls"
              onInvite={() => {}}
              switcher={<GroupSwitcher groups={switcherGroups} currentId={groups.girls.id} hrefFor={(id) => `/list/${id}`} onSelect={() => {}} />}
            />
          </Frame>
        </Specimen>
        <Specimen label="Tab bar (mobile and tablet)" wide>
          <Frame>
            <TabBar placement="inline" current="list" onAdd={add} label="Tab bar preview" />
          </Frame>
        </Specimen>
        <Specimen label="Tab bar, a group has new good words (dot on List)" wide>
          <Frame>
            <TabBar placement="inline" current="you" listDot onAdd={add} label="Tab bar with new good words preview" />
          </Frame>
        </Specimen>
        <Specimen label="Rail (1024px and up)" wide>
          <Frame>
            <Rail
              placement="inline"
              current="list"
              activityCount={3}
              groups={Object.values(groups)}
              newCounts={{ [groups.girls.id]: 3 }}
              currentGroupId={groups.college.id}
              onAdd={add}
              label="Rail preview"
            />
          </Frame>
        </Specimen>
        <Specimen label="Wordmark">
          <Wordmark />
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function Robot() {
  const handlers = { onPut: () => {}, onEditNote: () => {}, onChangeGroups: () => {}, onTakeBack: () => {} };
  return (
    <Component id="robot-guess" title="Robot guess card" spec="4.2.9">
      <div className="max-w-120">
        <RobotGuessCard title={titles.moth} vouchButton={<VouchButton vouched={false} {...handlers} />} />
      </div>
      <Note>Only after someone asks, in its own labeled section, never inside a list.</Note>
    </Component>
  );
}

/** Someone else's spoiler whose text is fetched on reveal, as in the app. */
function CoveredSpoiler() {
  const [body, setBody] = useState<CommentData["body"] | undefined>(undefined);
  return (
    <Comment
      comment={{ id: "cv1", author: people.luis, at: NOW, spoiler: true, body: [] }}
      viewerId={viewer.id}
      members={members.college}
      now={NOW}
      revealedBody={body}
      onReveal={() => setTimeout(() => setBody([{ kind: "text", text: "the letters were in the lifeboat all along" }]), 400)}
      onSave={() => {}}
      onDelete={() => {}}
    />
  );
}

function Conversation() {
  const [list, setList] = useState<CommentData[]>(initialComments);
  const [sendState, setSendState] = useState<Record<string, "sending" | "failed">>({});
  const { showToast } = useToast();

  function remove(id: string) {
    const removed = list.find((c) => c.id === id);
    const index = list.findIndex((c) => c.id === id);
    setList((l) => l.filter((c) => c.id !== id));
    showToast({
      message: "Comment deleted.",
      action: {
        label: "Undo",
        onAction: () => removed && setList((l) => [...l.slice(0, index), removed, ...l.slice(index)]),
      },
    });
  }

  return (
    <>
      <Component id="comment" title="Comment" spec="4.2.10">
        <Note>
          You are Tess, a member of College crew. Priya&apos;s comment mentions you; Mo&apos;s is a spoiler; yours is a
          spoiler you wrote. The last two show sending and failed.
        </Note>
        <div className="max-w-detail">
          <CommentList>
            {list.map((comment, i) => (
              <li key={comment.id} className="flex flex-col gap-4">
                {i === 3 && <NewCommentsDivider />}
                <Comment
                  comment={comment}
                  viewerId={viewer.id}
                  members={members.college}
                  now={NOW}
                  status={sendState[comment.id] ?? "sent"}
                  onSave={(body) => setList((l) => l.map((c) => (c.id === comment.id ? { ...c, body, edited: true } : c)))}
                  onDelete={() => remove(comment.id)}
                />
              </li>
            ))}
            <li>
              <Comment
                comment={{ id: "g1", author: viewer, at: NOW, body: [{ kind: "text", text: "and the music in that scene. (Same person within 5 minutes: name collapses.)" }] }}
                grouped
                viewerId={viewer.id}
                members={members.college}
                now={NOW}
                onSave={() => {}}
                onDelete={() => {}}
              />
            </li>
            <li>
              <Comment
                comment={{ id: "s1", author: viewer, at: NOW, body: [{ kind: "text", text: "wait until the fog episode" }] }}
                status="sending"
                viewerId={viewer.id}
                members={members.college}
                now={NOW}
                onSave={() => {}}
                onDelete={() => {}}
              />
            </li>
            <li>
              <Comment
                comment={{ id: "f1", author: viewer, at: NOW, body: [{ kind: "text", text: "ok I'm starting it tonight" }] }}
                status={sendState.f1 ?? "failed"}
                viewerId={viewer.id}
                members={members.college}
                now={NOW}
                onSave={() => {}}
                onDelete={() => showToast({ message: "Comment deleted." })}
                onRetry={() => {
                  setSendState((s) => ({ ...s, f1: "sending" }));
                  setTimeout(() => setSendState((s) => ({ ...s, f1: "failed" })), 1200);
                }}
              />
            </li>
            <li>
              <CoveredSpoiler />
            </li>
            <li>
              <Comment
                comment={{ id: "h1", author: people.jonah, at: NOW, body: [{ kind: "text", text: "Arrived at from a link: highlighted for 2 seconds (no motion when reduced)." }] }}
                highlighted
                viewerId={viewer.id}
                members={members.college}
                now={NOW}
                onSave={() => {}}
                onDelete={() => {}}
              />
            </li>
          </CommentList>
        </div>
        <Note>
          In the app, someone else&apos;s spoiler isn&apos;t in the page at all: revealing it fetches the text (the
          covered comment above waits a moment to show that).
        </Note>
      </Component>

      <Component id="composer" title="Composer with mentions" spec="4.2.11">
        <Note>Type @ or use the Mention button. Only College crew members are offered. Backspace after a mention removes it whole. On desktop, Enter sends and Shift+Enter adds a line.</Note>
        <div className="max-w-detail overflow-visible rounded-card border border-dashed border-subtle pt-48">
          <Composer
            group={groupsWithCounts[0]}
            members={members.college}
            viewerId={viewer.id}
            draftKey="styleguide:night-ferry:college-crew"
            onSend={({ body, spoiler }) => {
              setList((l) => [...l, { id: `new-${l.length}`, author: viewer, at: new Date(), body, spoiler }]);
              showToast({ message: spoiler ? "Sent, covered as a spoiler." : "Sent." });
            }}
          />
        </div>
      </Component>

      <Component id="spoiler-cover" title="Spoiler cover" spec="4.2.12">
        <div className="max-w-detail">
          <SpoilerCover authorName="Priya">
            {() => <p className="text-body text-default">the ferry never actually leaves the harbor</p>}
          </SpoilerCover>
        </div>
        <Note>The body isn&apos;t in the page until revealed. Try find-in-page for “harbor” before tapping.</Note>
      </Component>
    </>
  );
}

function Activity() {
  return (
    <Component id="activity-item" title="Activity item" spec="4.2.13">
      <div className="-mx-5 max-w-detail md:mx-0">
        <ActivityItem kind="mention" actor={people.priya} title={titles.nightFerry} group={groups.college} quote="@Tess you have to get to ep 6 before we talk" at={new Date(NOW.getTime() - 7_200_000)} unread href="#activity-item" now={NOW} />
        <ActivityItem kind="comment" actor={people.mo} title={titles.nightFerry} group={groups.college} spoiler at={new Date(NOW.getTime() - 2_400_000)} unread href="#activity-item" now={NOW} />
        <ActivityItem kind="comment" actor={people.jonah} title={titles.lowTide} group={groups.book} quote="the lighthouse scene. I had to pause it." at={new Date(NOW.getTime() - 86_400_000 * 2)} href="#activity-item" now={NOW} />
        <ActivityItem kind="started" actor={people.jonah} title={titles.moth} group={groups.college} quote="anyone seen this?" at={new Date(NOW.getTime() - 3_600_000 * 5)} unread href="#activity-item" now={NOW} />
        <ActivityItem kind="comment" actor={people.bea} actorNames="Bea and Priya" title={titles.heist} group={groups.girls} quote="the grandma steals every scene" at={new Date(NOW.getTime() - 86_400_000 * 3)} href="#activity-item" now={NOW} />
        <ActivityItem kind="join" actor={people.luis} group={groups.book} at={new Date(NOW.getTime() - 86_400_000 * 9)} href="#activity-item" now={NOW} />
        <ActivityItem
          kind="friendRequest"
          actor={people.mo}
          at={new Date(NOW.getTime() - 1_800_000)}
          unread
          now={NOW}
          actions={
            <>
              <Button variant="secondary">{t("friends.accept")}</Button>
              <Button variant="ghost">{t("friends.decline")}</Button>
            </>
          }
        />
        <ActivityItem kind="friendAccepted" actor={people.tess} at={new Date(NOW.getTime() - 86_400_000)} href="#activity-item" now={NOW} />
      </div>
    </Component>
  );
}

function PersonRows() {
  return (
    <Component id="person-row" title="Person row" spec="4.2.16">
      <ul className="flex max-w-reading flex-col divide-y divide-subtle">
        <PersonRow person={people.mo} variant="incoming" onAccept={() => {}} onDecline={() => {}} />
        <PersonRow person={people.luis} variant="fromGroup" groupName={groups.book.name} onAdd={() => {}} />
        <PersonRow person={people.jonah} variant="friend" onRemove={() => {}} />
        <PersonRow person={people.bea} variant="sent" onCancel={() => {}} />
      </ul>
    </Component>
  );
}

export function Domain() {
  return (
    <Section id="domain" title="Domain components" intro="The components that are Good Word (Section 4.2). All content is invented.">
      <Posters />
      <RecCards />
      <VouchButtons />
      <Search />
      <Switcher />
      <Visibility />
      <Invites />
      <Bars />
      <Robot />
      <Conversation />
      <Activity />
      <PersonRows />
    </Section>
  );
}
