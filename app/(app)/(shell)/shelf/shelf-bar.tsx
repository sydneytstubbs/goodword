"use client";

import { GroupSwitcher, type SwitcherGroup } from "@/components/domain/group-switcher";
import { IconButton } from "@/components/ui/icon-button";
import { t } from "@/lib/messages";
import NextLink from "next/link";
import { Icon } from "@/components/icon";
import { Tooltip } from "@/components/ui/tooltip";
import { useShelfNews } from "../shelf-news";

// The shelf's own bar: the group switcher, group details, and the invite
// button, which opens the current group's invite card in a sheet (F2.3). The
// full top bar with Activity (DS 4.2.8) arrives with steps 4 and 6.
export function ShelfBar({
  groups,
  currentId,
  onInvite,
}: {
  groups: SwitcherGroup[];
  currentId: string;
  onInvite?: () => void;
}) {
  const current = groups.find((g) => g.id === currentId);
  const { counts } = useShelfNews();

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <GroupSwitcher groups={groups} currentId={currentId} hrefFor={(id) => `/shelf/${id}`} newCounts={counts} />
      </div>
      {current && (
        <div className="flex items-center">
          <Tooltip content={t("groups.details.label")} align="end">
            <NextLink
              href={`/groups/${current.id}`}
              aria-label={t("groups.details.label")}
              className="group relative grid size-target place-items-center rounded-control text-default"
            >
              <span
                aria-hidden="true"
                className="absolute inset-1 rounded-control transition duration-fast ease-standard group-hover:bg-surface-hover group-active:bg-surface-pressed"
              />
              <Icon name="settings" size={24} className="relative" />
            </NextLink>
          </Tooltip>
          {onInvite && (
            <IconButton icon="share" iconSize={24} label={t("nav.invite", { group: current.name })} onClick={onInvite} tooltipAlign="end" />
          )}
        </div>
      )}
    </div>
  );
}
