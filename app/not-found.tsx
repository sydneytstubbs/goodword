import type { Metadata } from "next";
import { EmptyState } from "@/components/ui/empty-state";
import { ButtonLink } from "@/components/ui/button-link";
import { currentUser } from "@/lib/auth/session";
import { t } from "@/lib/messages";

// Any URL that matches no route. Signed-in people go back to their shelf;
// everyone else goes to the home page.
export const metadata: Metadata = {
  title: `${t("notFound.title")} · Good Word`,
  robots: { index: false, follow: false },
};

export default async function NotFound() {
  const user = await currentUser();
  return (
    <div className="min-h-dvh bg-surface text-default">
      <main className="mx-auto w-full max-w-content px-4 py-12">
        <h1 className="sr-only">{t("notFound.title")}</h1>
        <EmptyState
          headingLevel={2}
          title={t("notFound.title")}
          body={t("notFound.body")}
          action={
            user ? (
              <ButtonLink href="/shelf" variant="secondary">
                {t("notFound.goToShelf")}
              </ButtonLink>
            ) : (
              <ButtonLink href="/" variant="secondary">
                {t("notFound.goHome")}
              </ButtonLink>
            )
          }
        />
      </main>
    </div>
  );
}
