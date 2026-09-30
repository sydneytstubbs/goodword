import type { Metadata } from "next";
import Image from "next/image";
import pkg from "@/package.json";
import { TextLink } from "@/components/ui/text-link";
import { JUSTWATCH_URL } from "@/components/domain/where-to-watch";
import { requireOnboardedUser } from "@/lib/auth/session";
import { t, type MessageKey } from "@/lib/messages";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Help · Good Word" };

const TMDB_URL = "https://www.themoviedb.org";

const FAQ = ["what", "who", "groups", "leave", "delete"] as const;

// Desktop shortcuts (DS 3.9). Keys are shown as keycaps, never in UI copy.
const SHORTCUTS: Array<{ keys: string[]; label: MessageKey }> = [
  { keys: ["/"], label: "help.shortcuts.search" },
  { keys: ["n"], label: "help.shortcuts.add" },
  { keys: ["g", "s"], label: "help.shortcuts.shelf" },
  { keys: ["g", "y"], label: "help.shortcuts.myShelf" },
  { keys: ["g", "a"], label: "help.shortcuts.activity" },
  { keys: ["?"], label: "help.shortcuts.help" },
];

// Help (PRD F11, DS 5.16): the same place on every screen (My shelf › Help,
// and the rail's footer). A short FAQ, shortcuts, send feedback, and About
// with the privacy summary and the TMDB and JustWatch attributions (PRD 9).
export default async function HelpPage() {
  await requireOnboardedUser("/you/help");
  const sha = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7);
  const version = sha ? `${pkg.version} (${sha})` : pkg.version;

  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-12 px-4 py-8">
      <h1 className="text-title-l text-default">{t("help.title")}</h1>

      <Section id="questions" title={t("help.faqHeading")}>
        <div className="flex flex-col gap-6">
          {FAQ.map((key) => (
            <div key={key} className="flex flex-col gap-1">
              <h3 className="text-body-strong text-default">{t(`help.faq.${key}Q`)}</h3>
              <p className="text-body text-muted">{t(`help.faq.${key}A`)}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section id="shortcuts" title={t("help.shortcutsHeading")} intro={t("help.shortcutsIntro")}>
        <dl className="flex flex-col divide-y divide-subtle">
          {SHORTCUTS.map(({ keys, label }) => (
            <div key={label} className="flex min-h-11 items-center justify-between gap-4">
              <dt className="text-body text-default">{t(label)}</dt>
              <dd className="flex items-center gap-2 text-caption text-muted">
                {keys.map((key, i) => (
                  <span key={key} className="flex items-center gap-2">
                    {i > 0 && <span>{t("help.shortcuts.then")}</span>}
                    <kbd className="min-w-6 rounded-control border border-strong bg-surface-raised px-2 text-center text-label text-default">
                      {key}
                    </kbd>
                  </span>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section id="feedback" title={t("help.feedbackHeading")} intro={t("help.feedbackIntro")}>
        <FeedbackForm />
      </Section>

      <Section id="about" title={t("help.aboutHeading")}>
        <p className="text-body text-default">{t("help.privacySummary")}</p>
        <div className="flex gap-6">
          <TextLink href="/privacy" variant="standalone">
            {t("help.privacyLink")}
          </TextLink>
          <TextLink href="/terms" variant="standalone">
            {t("help.termsLink")}
          </TextLink>
        </div>
        <div className="flex flex-col gap-2 pt-2">
          <a href={TMDB_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 w-fit items-center rounded-control">
            <Image src="/attribution/tmdb.svg" alt={t("help.tmdbLogo")} width={123} height={16} className="h-4 w-auto" />
          </a>
          <p className="text-caption text-muted">{t("help.tmdbNotice")}</p>
        </div>
        <div className="flex flex-col gap-2">
          <a href={JUSTWATCH_URL} target="_blank" rel="noopener noreferrer" className="flex min-h-11 w-fit items-center rounded-control">
            <Image src="/attribution/justwatch.webp" alt={t("help.justWatchLogo")} width={98} height={16} className="h-4 w-auto" />
          </a>
          <p className="text-caption text-muted">{t("help.justWatchNotice")}</p>
        </div>
        <p className="text-caption text-muted">{t("help.version", { version })}</p>
      </Section>
    </main>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex scroll-mt-4 flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-title-m text-default">
        {title}
      </h2>
      {intro && <p className="text-body text-muted">{intro}</p>}
      {children}
    </section>
  );
}
