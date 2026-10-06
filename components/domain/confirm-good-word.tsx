"use client";

import { t } from "@/lib/messages";
import { Icon } from "../icon";
import { Textarea } from "../ui/textarea";
import { Poster } from "./poster";
import { titleMeta } from "./title-meta";
import type { Title } from "./types";
import { VisibilityLine, type FriendsPick, type GroupWithCount } from "./visibility-line";

// The confirm step of putting in a good word (DESIGN-SYSTEM.md 5.4): poster,
// title, and year; the optional note; and the visibility line, which opens
// the group picker. When the good word is already on every list picked, it
// says so instead of asking for a note (the sheet then offers Edit note).

export function NoteField({ value, onValueChange }: { value: string; onValueChange: (value: string) => void }) {
  return (
    <Textarea
      label={t("vouch.noteLabel")}
      optional
      placeholder={t("vouch.notePlaceholder")}
      value={value}
      onValueChange={onValueChange}
      maxLength={140}
      enterKeyHint="done"
    />
  );
}

export function ConfirmGoodWord({
  title,
  note,
  onNoteChange,
  already = false,
  groups,
  peopleCount,
  onChangeGroups,
  friends,
}: {
  title: Title;
  note: string;
  onNoteChange: (value: string) => void;
  /** Your good word is already on every list picked. */
  already?: boolean;
  /** The groups picked. */
  groups: GroupWithCount[];
  /** Unique people across them. */
  peopleCount: number;
  /** Opens the group picker; omit when you have no groups to pick from. */
  onChangeGroups?: () => void;
  /** Friends, with the home_enabled flag (PRD F16.2). */
  friends?: FriendsPick;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Poster title={title} size="row" />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="line-clamp-2 text-card-title text-default">{title.name}</p>
          <p className="text-caption text-muted">{titleMeta(title)}</p>
        </div>
      </div>
      {already ? (
        <p className="flex items-start gap-2 text-body text-default">
          <Icon name="vouched" size={20} className="mt-0.5 shrink-0 text-action-text" />
          {t("vouch.alreadyOnLists")}
        </p>
      ) : (
        <NoteField value={note} onValueChange={onNoteChange} />
      )}
      <VisibilityLine groups={groups} peopleCount={peopleCount} friends={friends} onChange={onChangeGroups} className="self-start" />
    </div>
  );
}
