import type { Metadata } from "next";
import { Wordmark } from "@/components/domain/wordmark";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { readUnsubscribeToken } from "@/lib/email/secrets";
import { t } from "@/lib/messages";
import { UnsubscribeForm } from "./unsubscribe-form";

export const metadata: Metadata = { title: "Unsubscribe · Good Word" };

// Unsubscribe from one kind of email, signed out (PRD F7.7). The link in
// each email's footer lands here; mail apps' own button POSTs /api/unsubscribe.
export default async function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  const { token } = await searchParams;
  const raw = typeof token === "string" ? token : "";
  const parsed = readUnsubscribeToken(raw);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-reading flex-col gap-8 px-4 py-12 md:justify-center">
      <Wordmark />
      {parsed ? (
        <UnsubscribeForm token={raw} pref={parsed.pref} />
      ) : (
        <>
          <h1 className="sr-only">{t("unsubscribe.invalidTitle")}</h1>
          <EmptyState
            headingLevel={2}
            title={t("unsubscribe.invalidTitle")}
            body={t("unsubscribe.invalid")}
            action={
              <ButtonLink href="/you/settings" variant="secondary">
                {t("unsubscribe.openSettings")}
              </ButtonLink>
            }
          />
        </>
      )}
    </main>
  );
}
