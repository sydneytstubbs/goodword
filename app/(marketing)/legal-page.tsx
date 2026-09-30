import NextLink from "next/link";
import { Wordmark } from "@/components/domain/wordmark";
import { t, type MessageKey } from "@/lib/messages";

// The privacy and terms pages (PRD 10.4, DS 5.14): plain language, public,
// and indexable. Sections are numbered keys in messages/en.json.

type Doc = "privacy" | "terms";
const SECTIONS: Record<Doc, number> = { privacy: 9, terms: 8 };

export function LegalPage({ doc }: { doc: Doc }) {
  const sections = Array.from({ length: SECTIONS[doc] }, (_, i) => i + 1);
  return (
    <div className="mx-auto flex w-full max-w-reading flex-col gap-10 px-4 py-10 md:py-16">
      <header>
        <NextLink href="/" aria-label={t("legal.backHome")} className="block w-fit rounded-control">
          <Wordmark />
        </NextLink>
      </header>
      <main id="main" className="flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-display-m text-default">{t(`legal.${doc}.title` as MessageKey)}</h1>
          <p className="text-caption text-muted">{t("legal.updated")}</p>
        </div>
        <p className="text-body text-default">{t(`legal.${doc}.intro` as MessageKey)}</p>
        {sections.map((n) => (
          <section key={n} className="flex flex-col gap-2">
            <h2 className="text-title-m text-default">{t(`legal.${doc}.s${n}h` as MessageKey)}</h2>
            <p className="text-body text-default">{t(`legal.${doc}.s${n}b` as MessageKey)}</p>
          </section>
        ))}
      </main>
    </div>
  );
}
