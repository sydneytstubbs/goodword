import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";

// A title TMDB doesn't have (or a malformed link).
export default function TitleNotFound() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-12">
      <h1 className="sr-only">{t("titleDetail.notFoundTitle")}</h1>
      <EmptyState
        headingLevel={2}
        title={t("titleDetail.notFoundTitle")}
        body={t("titleDetail.notFoundBody")}
        action={
          <ButtonLink href="/home" variant="secondary">
            {t("list.goToGroups")}
          </ButtonLink>
        }
      />
    </main>
  );
}
