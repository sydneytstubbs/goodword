"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { InviteCard, type InviteState } from "@/components/domain/invite-card";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { TextField } from "@/components/ui/text-field";
import { useToast } from "@/components/ui/toast";
import { markGroupJoinsRead } from "@/lib/conversations/actions";
import { calendarDate } from "@/lib/format";
import type { GroupDetail, Member } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { deleteGroup, leaveGroup, removeMember, renameGroup, resetInvite } from "../actions";
import { duplicateOf } from "../names";
import { useActivityCount } from "../../activity-count";

type Pending = { kind: "leave" } | { kind: "delete" } | { kind: "reset" } | { kind: "remove"; member: Member } | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-title-m text-default">{title}</h2>
      {children}
    </section>
  );
}

export function GroupDetails({
  group,
  meId,
  inviteLink,
  otherNames,
}: {
  group: GroupDetail;
  meId: string;
  inviteLink: string | null;
  otherNames: string[];
}) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState<Pending>(null);
  const [busy, startTransition] = useTransition();
  const [inviteState, setInviteState] = useState<InviteState>("active");
  const isOwner = group.me.role === "owner";
  const others = group.members.filter((m) => m.id !== meId);
  const heir = others[0];
  const people = group.members.map((m) => ({ id: m.id, name: m.name }));
  const failed = () => showToast({ message: t("groups.details.failed") });
  const { refresh: refreshActivity } = useActivityCount();

  // Seeing the members marks "Mo joined College crew" read (PRD F14).
  useEffect(() => {
    if (isOwner) markGroupJoinsRead(group.id).then(refreshActivity, () => {});
  }, [isOwner, group.id, refreshActivity]);

  function run(action: () => Promise<{ ok: boolean }>, onDone?: () => void) {
    startTransition(async () => {
      const result = await action();
      setPending(null);
      // Leaving and deleting redirect, so they don't come back here.
      if (!result?.ok) return failed();
      onDone?.();
      router.refresh();
    });
  }

  const dialog = (() => {
    if (!pending) return null;
    const cancel = (
      <Button variant="secondary" onClick={() => setPending(null)}>
        {t("common.cancel")}
      </Button>
    );
    switch (pending.kind) {
      case "leave": {
        const last = others.length === 0;
        return {
          title: t("groups.dialog.leaveTitle", { group: group.name }),
          body: last
            ? t("groups.dialog.leaveLastBody", { group: group.name })
            : isOwner
              ? t("groups.dialog.leaveOwnerBody", { name: heir.name })
              : t("groups.dialog.leaveBody"),
          irreversible: last,
          confirm: (
            <Button variant="danger" loading={busy} onClick={() => run(() => leaveGroup(group.id, group.name))}>
              {last ? t("groups.dialog.leaveLastConfirm") : t("groups.dialog.leaveConfirm")}
            </Button>
          ),
          cancel,
        };
      }
      case "delete":
        return {
          title: t("groups.dialog.deleteTitle", { group: group.name }),
          body: t("groups.dialog.deleteBody", { count: group.members.length }),
          irreversible: true,
          confirm: (
            <Button variant="danger" loading={busy} onClick={() => run(() => deleteGroup(group.id, group.name))}>
              {t("groups.dialog.deleteConfirm", { group: group.name })}
            </Button>
          ),
          cancel,
        };
      case "reset":
        return {
          title: t("groups.dialog.resetTitle"),
          body: t("groups.dialog.resetBody"),
          irreversible: true,
          confirm: (
            <Button variant="danger" loading={busy} onClick={() => run(() => resetInvite(group.id), () => setInviteState("reset"))}>
              {t("groups.dialog.resetConfirm")}
            </Button>
          ),
          cancel,
        };
      case "remove":
        return {
          title: t("groups.dialog.removeTitle", { name: pending.member.name, group: group.name }),
          body: t("groups.dialog.removeBody"),
          irreversible: true,
          confirm: (
            <Button variant="danger" loading={busy} onClick={() => run(() => removeMember(group.id, pending.member.id))}>
              {t("groups.dialog.removeConfirm", { name: pending.member.name })}
            </Button>
          ),
          cancel,
        };
    }
  })();

  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-10 px-4 py-8">
      <h1 className="text-display-m text-default break-words">{group.name}</h1>

      <Section title={t("groups.details.inviteHeading")}>
        {inviteLink && (
          <InviteCard group={{ id: group.id, name: group.name }} members={people} link={inviteLink} state={inviteState} inviterName="" />
        )}
      </Section>

      <Section title={t("groups.details.membersHeading")}>
        <ul className="flex flex-col divide-y divide-subtle">
          {group.members.map((member) => (
            <MemberRow
              key={member.id}
              member={member}
              isMe={member.id === meId}
              onRemove={isOwner && member.id !== meId ? () => setPending({ kind: "remove", member }) : undefined}
              groupName={group.name}
            />
          ))}
        </ul>
      </Section>

      {isOwner && (
        <Section title={t("groups.details.settingsHeading")}>
          <RenameForm group={group} otherNames={otherNames} />
          <div>
            <Button variant="secondary" icon="copyLink" onClick={() => setPending({ kind: "reset" })}>
              {t("groups.details.resetLink")}
            </Button>
          </div>
        </Section>
      )}

      <Section title={t("groups.details.leaveHeading")}>
        <div className="flex flex-col items-start gap-3">
          <Button variant="danger" icon="signOut" onClick={() => setPending({ kind: "leave" })}>
            {t("groups.details.leave")}
          </Button>
          {isOwner && (
            <Button variant="danger" icon="remove" onClick={() => setPending({ kind: "delete" })}>
              {t("groups.details.delete")}
            </Button>
          )}
        </div>
      </Section>

      <Dialog
        open={dialog !== null}
        onClose={() => !busy && setPending(null)}
        title={dialog?.title ?? ""}
        description={dialog?.body ?? ""}
        irreversible={dialog?.irreversible}
        actions={
          dialog && (
            <>
              {dialog.cancel}
              {dialog.confirm}
            </>
          )
        }
      />
    </main>
  );
}

function MemberRow({ member, isMe, onRemove, groupName }: { member: Member; isMe: boolean; onRemove?: () => void; groupName: string }) {
  const labels = [isMe ? t("groups.details.you") : null, member.role === "owner" ? t("groups.details.owner") : null].filter(Boolean);
  return (
    <li className="flex min-h-16 items-center gap-3 py-3">
      <Avatar person={member} size={40} decorative />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-body text-default">
          {member.name}
          {labels.length > 0 && <span className="text-muted"> · {labels.join(" · ")}</span>}
        </span>
        <span className="text-caption text-muted">
          {t("groups.details.joined", { date: calendarDate(new Date(member.joinedAt)) })}
        </span>
      </div>
      {onRemove && (
        <IconButton icon="remove" tone="muted" label={t("groups.details.removeMember", { name: member.name, group: groupName })} onClick={onRemove} tooltipAlign="end" />
      )}
    </li>
  );
}

function RenameForm({ group, otherNames }: { group: GroupDetail; otherNames: string[] }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [name, setName] = useState(group.name);
  const [error, setError] = useState(false);
  const [checked, setChecked] = useState(false);
  const [saving, startTransition] = useTransition();
  const duplicate = checked ? duplicateOf(name, otherNames) : null;

  return (
    <form
      noValidate
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return setError(true);
        startTransition(async () => {
          const result = await renameGroup(group.id, name);
          if (!result.ok) return showToast({ message: t("groups.details.failed") });
          showToast({ message: t("groups.details.renamed") });
          router.refresh();
        });
      }}
    >
      <TextField
        label={t("groups.details.renameLabel")}
        value={name}
        maxLength={40}
        autoComplete="off"
        onChange={(e) => {
          setName(e.target.value);
          if (e.target.value.trim()) setError(false);
        }}
        onBlur={() => setChecked(true)}
        helper={duplicate ? t("groups.new.duplicate", { name: duplicate }) : undefined}
        error={error ? t("groups.new.nameRequired") : undefined}
      />
      <div>
        <Button type="submit" variant="secondary" loading={saving}>
          {t("groups.details.renameSubmit")}
        </Button>
      </div>
    </form>
  );
}
