import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { t } from "@/lib/messages";

// A conversation under a good word you can't see, or that doesn't exist: the
// same words as any unknown page, so nothing hints that it's there (PRD F16.6 rule 4).
export default function ConversationNotFound() {
  return (
    <main className="mx-auto w-full max-w-content px-4 py-12">
      <h1 className="sr-only">{t("notFound.title")}</h1>
      <EmptyState
        headingLevel={2}
        title={t("notFound.title")}
        body={t("notFound.body")}
        action={
          <ButtonLink href="/home" variant="secondary">
            {t("notFound.goToGroups")}
          </ButtonLink>
        }
      />
    </main>
  );
}
