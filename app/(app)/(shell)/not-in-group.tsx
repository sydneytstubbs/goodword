import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { t } from "@/lib/messages";

// A non-member (or a group that doesn't exist: we never say which) sees this,
// without the group's name or members (PRD 6.4).
export function NotInGroup() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-12">
      <h1 className="sr-only">{t("list.notInGroupTitle")}</h1>
      <EmptyState
        headingLevel={2}
        title={t("list.notInGroupTitle")}
        body={t("list.notInGroupBody")}
        action={
          <ButtonLink href="/list" variant="secondary">
            {t("list.goToGroups")}
          </ButtonLink>
        }
      />
    </main>
  );
}
