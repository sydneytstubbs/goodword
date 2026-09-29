"use client";

import { useState } from "react";
import { IconButton } from "@/components/ui/icon-button";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { CountBadge, LabelBadge, UnreadDot } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button, type ButtonSize, type ButtonVariant } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ChipButton, FilterChip, GroupChip, GroupDot } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Menu } from "@/components/ui/menu";
import { Milestone } from "@/components/ui/milestone";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Sheet } from "@/components/ui/sheet";
import { Skeleton, SkeletonRegion } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { TextField } from "@/components/ui/text-field";
import { TextLink } from "@/components/ui/text-link";
import { Textarea } from "@/components/ui/textarea";
import { ToastView, useToast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/tooltip";
import { groups, members, people } from "./fixtures";
import { Component, Frame, Note, Section, Specimen, SpecimenGrid } from "./parts";

const VARIANTS: ButtonVariant[] = ["primary", "secondary", "ghost", "danger"];
const LABELS: Record<ButtonVariant, string> = {
  primary: "Put in a good word",
  secondary: "Copy link",
  ghost: "Cancel",
  danger: "Leave group",
};
const SIZES: ButtonSize[] = ["lg", "md", "sm"];

function Buttons() {
  const [loading, setLoading] = useState(false);
  const [explained, setExplained] = useState(false);
  return (
    <Component id="button" title="Button" spec="4.1.1">
      <SpecimenGrid>
        {VARIANTS.map((variant) => (
          <Specimen key={variant} label={`${variant}: default, hover, pressed, focus`}>
            <Button variant={variant}>{LABELS[variant]}</Button>
            <Button variant={variant} data-force="hover">
              {LABELS[variant]}
            </Button>
            <Button variant={variant} data-force="hover pressed">
              {LABELS[variant]}
            </Button>
            <Button variant={variant} data-force="focus">
              {LABELS[variant]}
            </Button>
          </Specimen>
        ))}
        <Specimen label="Sizes: lg 48, md 40 (44 hit), sm 32 (44 hit)">
          {SIZES.map((size) => (
            <Button key={size} variant="secondary" size={size}>
              Size {size}
            </Button>
          ))}
        </Specimen>
        <Specimen label="With icon">
          <Button variant="primary" icon="add">
            Put in a good word
          </Button>
          <Button variant="secondary" icon="copyLink">
            Copy link
          </Button>
        </Specimen>
        <Specimen label="Loading (spinner after 300ms, width locked)">
          <Button variant="primary" loading={loading} onClick={() => setLoading(true)}>
            Put in a good word
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setLoading(false)}>
            Reset
          </Button>
          <Button variant="primary" loading>
            Always loading
          </Button>
        </Specimen>
        <Specimen label="Disabled, and the preferred alternative: explain">
          <Button variant="primary" aria-disabled="true">
            Create group
          </Button>
          <div className="flex flex-col gap-1">
            <Button variant="primary" onClick={() => setExplained(true)}>
              Create group
            </Button>
            {explained && <p className="text-caption text-danger">Add a name first.</p>}
          </div>
        </Specimen>
        <Specimen label="Full width (main action of a sheet)" wide>
          <div className="w-full max-w-120">
            <Button variant="primary" size="lg" fullWidth>
              Put in a good word
            </Button>
          </div>
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function IconButtons() {
  const [on, setOn] = useState(false);
  return (
    <Component id="icon-button" title="Icon button and tooltip" spec="4.1.2, 4.1.14">
      <SpecimenGrid>
        <Specimen label="Default, hover, pressed, focus">
          <IconButton icon="close" label="Close" />
          <IconButton icon="close" label="Close" data-force="hover" />
          <IconButton icon="close" label="Close" data-force="hover pressed" />
          <IconButton icon="close" label="Close" data-force="focus" />
        </Specimen>
        <Specimen label="Muted, 24px, toggle (fill when on)">
          <IconButton icon="more" tone="muted" label="More actions" />
          <IconButton icon="activity" iconSize={24} label="Activity" />
          <IconButton
            icon="spoiler"
            label="Spoiler"
            aria-pressed={on}
            weight={on ? "fill" : "regular"}
            onClick={() => setOn(!on)}
          />
        </Specimen>
        <Specimen label="With count badge">
          <IconButton icon="activity" iconSize={24} label="Activity, 3 unread" badge={<CountBadge count={3} label="" />} />
        </Specimen>
        <Specimen label="Tooltip: desktop only, after 500ms hover or at once on focus; Esc dismisses">
          <Tooltip content="Shortcut: n">
            <Button variant="secondary">Hover or Tab here</Button>
          </Tooltip>
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function Links() {
  return (
    <Component id="link" title="Link" spec="4.1.3">
      <SpecimenGrid>
        <Specimen label="Inline: default, hover, focus">
          <p className="text-body text-default">
            Read the <TextLink href="#link">privacy summary</TextLink>, then{" "}
            <TextLink href="#link" data-force="hover">
              the terms
            </TextLink>{" "}
            and{" "}
            <TextLink href="#link" data-force="focus">
              the FAQ
            </TextLink>
            .
          </p>
        </Specimen>
        <Specimen label="Standalone: default, hover">
          <TextLink href="#link" variant="standalone">
            See all 12 comments
          </TextLink>
          <TextLink href="#link" variant="standalone" data-force="hover">
            See all 12 comments
          </TextLink>
        </Specimen>
        <Specimen label="Opens in a new tab (mid-task only)">
          <TextLink href="#link" newTab>
            Where to watch data by JustWatch
          </TextLink>
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function Fields() {
  const [email, setEmail] = useState("sam@example");
  const [note, setNote] = useState("ep 3 is where it gets you. the whole thing is about a ferry that only runs at night, and a captain who won't say why");
  return (
    <Component id="text-field" title="Text field and textarea" spec="4.1.4, 4.1.5">
      <SpecimenGrid>
        <Specimen label="Default">
          <TextField label="Email" type="email" autoComplete="email" helper="We'll send a sign-in link." className="w-full" />
        </Specimen>
        <Specimen label="Hover">
          <TextField label="Group name" data-force="hover" className="w-full" />
        </Specimen>
        <Specimen label="Focus">
          <TextField label="Group name" data-force="focus" defaultValue="College crew" className="w-full" />
        </Specimen>
        <Specimen label="Error (input kept, message says what to do)">
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error="That email looks incomplete. Check for a missing @ or dot."
            className="w-full"
          />
        </Specimen>
        <Specimen label="Read-only">
          <TextField label="Invite link" readOnly value="https://goodword.app/join/k7x2p" className="w-full" />
        </Specimen>
        <Specimen label="Disabled">
          <TextField label="Region" disabled defaultValue="United States" className="w-full" />
        </Specimen>
        <Specimen label="Note field: empty, optional">
          <Textarea label="Anything to add?" optional placeholder="ep 3 is where it gets you" className="w-full" />
        </Specimen>
        <Specimen label="Note field: counter from 100 of 140, grows to 5 lines">
          <Textarea label="Anything to add?" optional value={note} onValueChange={setNote} className="w-full" />
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function Toggles() {
  const [digest, setDigest] = useState(true);
  const [mentions, setMentions] = useState(false);
  const [view, setView] = useState<"all" | "movies" | "shows">("all");
  return (
    <>
      <Component id="checkbox" title="Checkbox" spec="4.1.6">
        <SpecimenGrid>
          <Specimen label="Unchecked, checked, focus, disabled" wide>
            <div className="flex w-full max-w-120 flex-col">
              <Checkbox label="College crew" description="6 people" leading={<GroupDot group={groups.college} />} />
              <Checkbox label="The girls" description="3 people" leading={<GroupDot group={groups.girls} />} defaultChecked />
              <Checkbox label="Sunday book club" description="4 people" leading={<GroupDot group={groups.book} />} data-force="focus" />
              <Checkbox label="Film club" description="You left this group" disabled />
            </div>
          </Specimen>
        </SpecimenGrid>
      </Component>
      <Component id="switch" title="Switch" spec="4.1.7">
        <div className="flex max-w-120 flex-col">
          <Switch label="Weekly digest" description="Thursdays at 5pm" checked={digest} onCheckedChange={setDigest} />
          <Switch label="Mention emails" checked={mentions} onCheckedChange={setMentions} />
        </div>
      </Component>
      <Component id="segmented" title="Segmented control" spec="4.1.8">
        <SpecimenGrid>
          <Specimen label="Arrow keys move; the selection slides">
            <SegmentedControl
              label="Show"
              value={view}
              onValueChange={setView}
              segments={[
                { value: "all", label: "All" },
                { value: "movies", label: "Movies" },
                { value: "shows", label: "Shows" },
              ]}
              className="w-full max-w-80"
            />
          </Specimen>
        </SpecimenGrid>
      </Component>
    </>
  );
}

function Chips() {
  const [selected, setSelected] = useState<string[]>(["Netflix"]);
  const services: Array<[string, number]> = [
    ["Netflix", 12],
    ["Hulu", 4],
    ["Max", 7],
    ["Prime Video", 3],
    ["Apple TV+", 2],
  ];
  return (
    <Component id="chips" title="Chips" spec="4.1.9">
      <SpecimenGrid>
        <Specimen label="Group chip: static, and as a link">
          <GroupChip group={groups.college} />
          <GroupChip group={groups.girls} href="#chips" />
        </Specimen>
        <Specimen label="Filter chip: unselected, hover, selected (Check + ink), focus">
          <FilterChip label="Comedy" selected={false} />
          <FilterChip label="Comedy" selected={false} data-force="hover" />
          <FilterChip label="Comedy" selected />
          <FilterChip label="Comedy" selected={false} data-force="focus" />
        </Specimen>
        <Specimen label="Chip button: opens a sheet; shows how many filters inside are on">
          <ChipButton label="More filters" />
          <ChipButton label="More filters" count={2} countLabel="More filters, 2 on" />
        </Specimen>
        <Specimen label="With counts; at most five, then More filters" wide>
          <div className="flex flex-wrap gap-2">
            {services.map(([name, count]) => (
              <FilterChip
                key={name}
                label={name}
                count={count}
                selected={selected.includes(name)}
                onClick={() => setSelected((s) => (s.includes(name) ? s.filter((x) => x !== name) : [...s, name]))}
              />
            ))}
            <ChipButton label="More filters" />
          </div>
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function Avatars() {
  return (
    <Component id="avatar" title="Avatar and avatar stack" spec="4.1.10">
      <SpecimenGrid>
        <Specimen label="Sizes 24, 32, 40, 56; tone from the user id">
          <Avatar person={people.priya} size={24} />
          <Avatar person={people.jonah} size={32} />
          <Avatar person={people.mo} size={40} />
          <Avatar person={people.bea} size={56} />
        </Specimen>
        <Specimen label="All six people">
          {members.college.map((p) => (
            <Avatar key={p.id} person={p} size={32} />
          ))}
        </Specimen>
        <Specimen label="Stack: up to 3, then +N; one accessible name">
          <AvatarStack people={[people.priya]} />
          <AvatarStack people={[people.priya, people.jonah]} />
          <AvatarStack people={members.college} />
          <AvatarStack people={members.college} size={32} />
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function Badges() {
  return (
    <Component id="badge" title="Badge" spec="4.1.11">
      <SpecimenGrid>
        <Specimen label="Count: 1, 12, capped at 99+">
          <CountBadge count={1} />
          <CountBadge count={12} />
          <CountBadge count={140} />
        </Specimen>
        <Specimen label="Label">
          <LabelBadge />
        </Specimen>
        <Specimen label="Unread dots, 8 and 6">
          <UnreadDot label="Unread" />
          <UnreadDot size={6} label="New comments" />
        </Specimen>
      </SpecimenGrid>
    </Component>
  );
}

function Overlays() {
  const [sheet, setSheet] = useState(false);
  const [sheetWithField, setSheetWithField] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [destructive, setDestructive] = useState(false);
  const { showToast } = useToast();

  return (
    <>
      <Component id="menu" title="Menu" spec="4.1.12">
        <Specimen label="A sheet on mobile, a popover from 1024px. Destructive items last, after a divider.">
          <Menu
            label="More actions for The Night Ferry"
            items={[
              { label: "Edit note", icon: "edit", onSelect: () => showToast({ message: "Edit note" }) },
              { label: "Change groups", icon: "group", onSelect: () => showToast({ message: "Change groups" }) },
              { label: "Take it back", icon: "remove", destructive: true, onSelect: () => showToast({ message: "Taken back.", action: { label: "Undo", onAction: () => {} } }) },
            ]}
            trigger={(props) => <IconButton icon="more" label="More actions for The Night Ferry" {...props} />}
          />
        </Specimen>
      </Component>

      <Component id="sheet" title="Sheet and dialog" spec="4.1.13">
        <SpecimenGrid>
          <Specimen label="Sheet: focus moves in, Esc or scrim closes, focus returns">
            <Button onClick={() => setSheet(true)}>Open a sheet</Button>
            <Button onClick={() => setSheetWithField(true)}>Sheet with a field</Button>
          </Specimen>
          <Specimen label="Dialog: decisions only; irreversible ones ignore the scrim">
            <Button onClick={() => setDialog(true)}>Open the leave dialog</Button>
            <Button onClick={() => setDestructive(true)}>Open the delete dialog</Button>
          </Specimen>
        </SpecimenGrid>
        <Sheet open={sheet} onClose={() => setSheet(false)} title="Your shelves">
          <p className="text-body text-muted">
            Sheets hold tasks and pickers on mobile. Swipe down on the header, tap the scrim, press Esc, or use Close.
          </p>
        </Sheet>
        <Sheet
          open={sheetWithField}
          onClose={() => setSheetWithField(false)}
          title="Name your group"
          footer={
            <Button variant="primary" size="lg" fullWidth onClick={() => setSheetWithField(false)}>
              Create group
            </Button>
          }
        >
          <TextField label="Group name" placeholder="College crew" helper="You can change it later." />
        </Sheet>
        <Dialog
          open={dialog}
          onClose={() => setDialog(false)}
          title="Leave College crew?"
          description="Your good words will leave this shelf too. You can rejoin with an invite."
          actions={
            <>
              <Button onClick={() => setDialog(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => setDialog(false)}>
                Leave group
              </Button>
            </>
          }
        />
        <Dialog
          open={destructive}
          irreversible
          onClose={() => setDestructive(false)}
          title="Delete College crew?"
          description="This removes 42 good words for 6 people and can't be undone."
          actions={
            <>
              <Button onClick={() => setDestructive(false)}>Cancel</Button>
              <Button variant="danger" onClick={() => setDestructive(false)}>
                Delete College crew
              </Button>
            </>
          }
        />
      </Component>

      <Component id="toast" title="Toast" spec="4.1.15">
        <SpecimenGrid>
          <Specimen label="Static previews" wide>
            <div className="flex flex-col items-start gap-3">
              <ToastView message="On your shelf. Priya, Jonah, and 4 others will see it." action={{ label: "Undo", onAction: () => {} }} />
              <ToastView message="Link copied. Send it to someone whose taste you trust." />
            </div>
          </Specimen>
          <Specimen label="Live: one at a time; 5s, or 8s with an action; pauses on hover and focus">
            <Button onClick={() => showToast({ message: "Link copied. Send it to someone whose taste you trust." })}>Show toast</Button>
            <Button
              onClick={() =>
                showToast({
                  message: "That didn't save. Check your connection and try again.",
                  action: { label: "Retry", onAction: () => {} },
                })
              }
            >
              Toast with Retry
            </Button>
          </Specimen>
        </SpecimenGrid>
      </Component>
    </>
  );
}

function StatusComponents() {
  const [banner, setBanner] = useState(true);
  const [milestone, setMilestone] = useState(true);
  return (
    <>
      <Component id="banner" title="Banner" spec="4.1.16">
        <div className="flex flex-col gap-3">
          {banner ? (
            <Banner icon="offline" onDismiss={() => setBanner(false)}>
              You&apos;re offline. We&apos;ll send your changes when you&apos;re back.
            </Banner>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setBanner(true)}>
              Show the info banner again
            </Button>
          )}
          <Banner tone="warning" action={<Button size="sm">Send a new link</Button>}>
            This sign-in link has expired. We can send a new one.
          </Banner>
          <Banner tone="error" blocking action={<Button size="sm">Try again</Button>}>
            Good Word is having a moment. Try again in a minute.
          </Banner>
        </div>
      </Component>

      <Component id="skeleton" title="Skeleton and spinner" spec="4.1.17">
        <SpecimenGrid>
          <Specimen label="Skeleton matches the final layout (a grid card)">
            <SkeletonRegion label="Loading shelf" className="grid w-full grid-cols-2 gap-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex flex-col gap-2.5">
                  <Skeleton className="aspect-2/3 w-full rounded-poster" />
                  <Skeleton className="h-4 w-3/4 rounded-control" />
                  <Skeleton className="h-3 w-1/2 rounded-control" />
                </div>
              ))}
            </SkeletonRegion>
          </Specimen>
          <Specimen label="Spinner: inside buttons and small inline actions only">
            <Spinner size={16} />
            <Spinner size={20} />
          </Specimen>
        </SpecimenGrid>
      </Component>

      <Component id="empty-state" title="Empty and error states" spec="4.1.18, 4.1.19">
        <SpecimenGrid>
          <Specimen label="Empty (first use)" wide>
            <Frame>
              <div className="p-8">
                <EmptyState
                  headingLevel={4}
                  showShelf
                  title="Nothing here yet"
                  body="Be the first to put in a good word."
                  action={<Button variant="primary" icon="add">Put in a good word</Button>}
                />
              </div>
            </Frame>
          </Specimen>
          <Specimen label="Empty (no results)" wide>
            <Frame>
              <div className="p-8">
                <EmptyState
                  headingLevel={4}
                  title="Nobody's vouched for a Netflix movie yet."
                  body="Filters: Movies, Netflix."
                  action={<Button>Clear filters</Button>}
                />
              </div>
            </Frame>
          </Specimen>
          <Specimen label="Error" wide>
            <Frame>
              <div className="p-8">
                <ErrorState
                  headingLevel={4}
                  title="This shelf didn't load"
                  body="Check your connection and try again."
                  action={<Button>Retry</Button>}
                />
              </div>
            </Frame>
          </Specimen>
        </SpecimenGrid>
      </Component>

      <Component id="milestone" title="Milestone moment" spec="4.1.20">
        {milestone ? (
          <Milestone
            line="Your first good word."
            body="Your friends will see it on their shelves."
            onDismiss={() => setMilestone(false)}
          />
        ) : (
          <div>
            <Button variant="ghost" size="sm" onClick={() => setMilestone(true)}>
              Show it again
            </Button>
          </div>
        )}
        <Note>Fades and rises once, and is announced once through the polite live region.</Note>
      </Component>
    </>
  );
}

export function Primitives() {
  return (
    <Section id="primitives" title="Primitives" intro="Every component in every state from 3.8 (Section 4.1). Hover, pressed and focus are forced with data-force so they can be seen side by side.">
      <Buttons />
      <IconButtons />
      <Links />
      <Fields />
      <Toggles />
      <Chips />
      <Avatars />
      <Badges />
      <Overlays />
      <StatusComponents />
    </Section>
  );
}
