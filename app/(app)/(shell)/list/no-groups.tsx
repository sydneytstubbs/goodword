"use client";

import { ButtonLink } from "@/components/ui/button-link";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";
import { useAdd } from "../add";
import { ListMilestone } from "./list-cards";

// No groups yet (PRD F10, F5.7): start one, or put in a good word just for
// you, which lives on My list until friends join.
export function NoGroups() {
  const { openAdd } = useAdd();
  return (
    <>
      <ListMilestone />
      <EmptyState
        showList
        headingLevel={2}
        title={t("list.noGroupsTitle")}
        body={t("list.noGroupsBody")}
        action={
          <div className="flex flex-col items-start gap-4 md:items-center">
            <div className="flex flex-wrap gap-3 md:justify-center">
              <ButtonLink href="/groups/new" variant="primary" size="lg" icon="add">
                {t("list.startGroup")}
              </ButtonLink>
              <Button variant="secondary" size="lg" onClick={() => openAdd({ entryPoint: "empty_state" })}>
                {t("vouch.put")}
              </Button>
            </div>
            <p className="text-caption text-muted">{t("list.inviteHint")}</p>
          </div>
        }
      />
    </>
  );
}
