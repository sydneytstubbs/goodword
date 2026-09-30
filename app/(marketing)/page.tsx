import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Wordmark } from "@/components/domain/wordmark";
import { buttonBase, buttonSizes, buttonVariants } from "@/components/ui/button-styles";
import { groups, members, people, titles } from "@/components/marketing/content";
import { ComingSoon, MarketingNav } from "@/components/marketing/nav";
import { PhoneFrame } from "@/components/marketing/phone-frame";
import { QuoteCard } from "@/components/marketing/quote-card";
import { RevealObserver } from "@/components/marketing/reveal-observer";
import {
  ConfirmSheetVignette,
  ConversationScreen,
  FilteredShelfVignette,
  HeroShelfScreen,
  ShelfColumn,
  TwoShelvesVignette,
} from "@/components/marketing/vignettes";
import { cn } from "@/lib/cn";
import { t, tRich, type MessageKey } from "@/lib/messages";

// The marketing page (good-word-marketing-page-spec.md v2), sections in the
// spec's fixed order. Static, no forms, no cookies, no third-party scripts.

export const metadata: Metadata = {
  title: { absolute: t("marketing.meta.title") },
  description: t("marketing.meta.description"),
  openGraph: {
    title: t("marketing.meta.title"),
    description: t("marketing.meta.description"),
    type: "website",
    siteName: t("wordmark.name"),
  },
  twitter: { card: "summary_large_image" },
};

const gutter = "mx-auto w-full max-w-marketing px-5 md:px-8 lg:px-10";

function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-overline text-muted", className)}>{children}</p>;
}

function SectionHeading({ id, eyebrow, headline, body }: { id: string; eyebrow?: string; headline: MessageKey; body?: string }) {
  return (
    <div data-reveal className="flex max-w-reading flex-col gap-5">
      {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <h2 id={id} className="text-display-l text-default">
        {tRich(headline)}
      </h2>
      {body && <p className="text-body-marketing text-muted">{body}</p>}
    </div>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-heading" className={cn(gutter, "pt-12 pb-16 md:pt-24 md:pb-24")}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center lg:gap-6">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Eyebrow>{t("marketing.hero.eyebrow")}</Eyebrow>
          <h1 id="hero-heading" className="text-display-xl text-default">
            {tRich("marketing.hero.headline")}
          </h1>
          <p className="max-w-subhead text-body-marketing text-muted">{t("marketing.hero.subhead")}</p>
          <div>
            {/* It goes somewhere (in-page), so it's a link with the primary button's look. */}
            <a href="#how-it-works" className={cn(buttonBase, buttonVariants.primary, buttonSizes.lg)}>
              {t("marketing.hero.cta")}
            </a>
          </div>
        </div>
        <div className="relative lg:col-span-5">
          <PhoneFrame label={t("marketing.hero.phoneAlt")} className="mx-auto max-w-90 lg:me-0 lg:max-w-80">
            <HeroShelfScreen />
          </PhoneFrame>
          <QuoteCard
            quote={t("marketing.hero.quote")}
            person={people.priya}
            context={t("marketing.hero.quoteContext", { title: titles.nightFerry.name })}
            className="mx-auto mt-6 max-w-90 lg:absolute lg:-bottom-12 lg:-start-16 lg:mt-0 lg:w-80 lg:max-w-none"
          />
        </div>
      </div>
    </section>
  );
}

function Problem() {
  return (
    <section aria-labelledby="problem-heading" className={cn(gutter, "py-16 md:py-24")}>
      <SectionHeading
        id="problem-heading"
        eyebrow={t("marketing.problem.eyebrow")}
        headline="marketing.problem.headline"
        body={t("marketing.problem.body")}
      />
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2 md:items-start">
        <div data-reveal className="flex flex-col gap-3">
          <Eyebrow>{t("marketing.problem.algorithmLabel")}</Eyebrow>
          <div className="flex flex-col gap-4 rounded-card bg-surface-sunken p-6">
            <p className="text-caption text-muted">{t("marketing.problem.algorithmCaption")}</p>
            <div role="img" aria-label={t("marketing.problem.algorithmAlt")} className="grid grid-cols-4 gap-2">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className="aspect-2/3 rounded-poster bg-surface-pressed" />
              ))}
            </div>
          </div>
        </div>
        <div data-reveal data-reveal-index="1" className="flex flex-col gap-3">
          <Eyebrow>{t("marketing.problem.friendLabel")}</Eyebrow>
          <QuoteCard quote={t("marketing.problem.friendQuote")} person={people.jonah} />
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { n: "01", title: "marketing.how.step1Title", body: "marketing.how.step1Body", alt: "marketing.how.step1Alt", vignette: <ConfirmSheetVignette /> },
  { n: "02", title: "marketing.how.step2Title", body: "marketing.how.step2Body", alt: "marketing.how.step2Alt", vignette: <TwoShelvesVignette /> },
  { n: "03", title: "marketing.how.step3Title", body: "marketing.how.step3Body", alt: "marketing.how.step3Alt", vignette: <FilteredShelfVignette /> },
] as const;

function HowItWorks() {
  return (
    <section id="how-it-works" tabIndex={-1} aria-labelledby="how-heading" className={cn(gutter, "scroll-mt-20 py-16 md:py-24")}>
      <SectionHeading id="how-heading" eyebrow={t("marketing.how.eyebrow")} headline="marketing.how.headline" />
      <ol className="mt-16 flex flex-col gap-16 md:gap-24">
        {STEPS.map((step, i) => (
          <li key={step.n} className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center lg:gap-6">
            <div
              data-reveal
              className={cn("flex flex-col gap-3 lg:col-span-5", i % 2 === 1 ? "lg:order-2 lg:col-start-8" : "lg:order-1")}
            >
              <p className="text-overline text-muted tabular-nums">{step.n}</p>
              <h3 className="text-display-m text-default">{t(step.title)}</h3>
              <p className="max-w-subhead text-body-marketing text-muted">{t(step.body)}</p>
            </div>
            <div
              data-reveal
              data-reveal-index="1"
              className={cn("lg:col-span-6", i % 2 === 1 ? "lg:order-1 lg:col-start-1" : "lg:order-2 lg:col-start-7")}
            >
              <div role="img" aria-label={t(step.alt)}>
                <div inert className="mx-auto max-w-120">
                  {step.vignette}
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Groups() {
  return (
    <section id="groups" tabIndex={-1} aria-labelledby="groups-heading" className={cn(gutter, "scroll-mt-20 py-16 md:py-24")}>
      <SectionHeading
        id="groups-heading"
        eyebrow={t("marketing.groups.eyebrow")}
        headline="marketing.groups.headline"
        body={t("marketing.groups.body")}
      />
      <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <div data-reveal>
          <ShelfColumn
            group={groups.college}
            tone={3}
            people={members.college}
            shelf={[{ title: titles.nightFerry }, { title: titles.moth }, { title: titles.lowTide }]}
          />
        </div>
        <div data-reveal data-reveal-index="1">
          <ShelfColumn
            group={groups.girls}
            tone={4}
            people={members.girls}
            shelf={[
              { title: titles.parking },
              { title: titles.lowTide, caption: t("marketing.groups.onTwoShelves") },
              { title: titles.heist },
            ]}
          />
        </div>
        <div data-reveal data-reveal-index="2">
          <ShelfColumn
            group={groups.book}
            tone={2}
            people={members.book}
            shelf={[{ title: titles.salt }, { title: titles.weather }, { title: titles.choir }]}
          />
        </div>
      </div>
    </section>
  );
}

function Talk() {
  return (
    <section id="talk" tabIndex={-1} aria-labelledby="talk-heading" className={cn(gutter, "scroll-mt-20 py-16 md:py-24")}>
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center lg:gap-6">
        <div className="lg:col-span-6">
          <SectionHeading
            id="talk-heading"
            eyebrow={t("marketing.talk.eyebrow")}
            headline="marketing.talk.headline"
            body={t("marketing.talk.body")}
          />
        </div>
        <div data-reveal className="flex flex-col items-center gap-4 lg:col-span-5 lg:col-start-8">
          <PhoneFrame label={t("marketing.talk.phoneAlt")} className="max-w-90">
            <ConversationScreen />
          </PhoneFrame>
          <p className="text-caption text-muted">{t("marketing.talk.note")}</p>
        </div>
      </div>
    </section>
  );
}

function HumansOnly() {
  const statements = [
    ["marketing.humans.lead1", "marketing.humans.rest1"],
    ["marketing.humans.lead2", "marketing.humans.rest2"],
    ["marketing.humans.lead3", "marketing.humans.rest3"],
  ] as const;
  return (
    <section aria-labelledby="humans-heading" className="bg-inverse text-inverse">
      <div className={cn(gutter, "py-24 md:py-32")}>
        <h2 id="humans-heading" data-reveal className="text-display-xl text-inverse">
          {tRich("marketing.humans.headline")}
        </h2>
        <ul className="mt-12 flex max-w-reading flex-col divide-y divide-inverse border-y border-inverse">
          {statements.map(([lead, rest], i) => (
            <li key={lead} data-reveal data-reveal-index={String(i)} className="py-6 text-title-m font-regular">
              <strong className="font-semibold text-inverse">{t(lead)}</strong>{" "}
              <span className="text-inverse-muted">{t(rest)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function WhatItIsnt() {
  const items = ["item1", "item2", "item3", "item4", "item5"] as const;
  return (
    <section aria-label={t("marketing.isnt.label")} className={cn(gutter, "py-16 md:py-24")}>
      <div data-reveal className="flex flex-col gap-6">
        <p className="sr-only">{t("marketing.isnt.summary")}</p>
        <p aria-hidden="true" className="flex flex-wrap gap-x-3 gap-y-1 text-title-m font-regular text-muted">
          {items.map((item, i) => (
            <span key={item} className="inline-flex gap-3">
              <span className="line-through decoration-1">{t(`marketing.isnt.${item}`)}</span>
              {i < items.length - 1 && <span>·</span>}
            </span>
          ))}
        </p>
        <p className="text-display-m text-default italic">{t("marketing.isnt.line")}</p>
      </div>
    </section>
  );
}

const FAQ = [1, 2, 3, 4, 5, 6, 7] as const;

function Faq() {
  return (
    <section id="faq" tabIndex={-1} aria-labelledby="faq-heading" className={cn(gutter, "scroll-mt-20 py-16 md:py-24")}>
      <h2 id="faq-heading" data-reveal className="text-display-l text-default">
        {t("marketing.faq.headline")}
      </h2>
      <div data-reveal className="mt-10 divide-y divide-subtle border-y border-subtle">
        {FAQ.map((n) => (
          <details key={n} className="group">
            <summary className="flex min-h-target cursor-pointer items-center justify-between gap-6 py-5 text-body-marketing font-medium text-default">
              {t(`marketing.faq.q${n}`)}
              <span aria-hidden="true" className="relative grid size-4 shrink-0 place-items-center">
                <span className="absolute h-px w-4 bg-default" />
                <span className="absolute h-4 w-px bg-default group-open:hidden" />
              </span>
            </summary>
            <p className="max-w-reading pb-6 text-body-marketing text-muted">{t(`marketing.faq.a${n}`)}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

function Closing() {
  return (
    <section aria-labelledby="closing-heading" className={cn(gutter, "py-24 md:py-32")}>
      <div data-reveal className="flex flex-col gap-6">
        <h2 id="closing-heading" className="text-display-l text-default">
          {tRich("marketing.closing.headline")}
        </h2>
        <p className="text-body-marketing text-muted">{t("marketing.closing.subhead")}</p>
        <ComingSoon className="text-overline text-muted" />
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-subtle">
      <div className={cn(gutter, "flex flex-col gap-4 py-10 md:flex-row md:items-center md:justify-between")}>
        <Wordmark />
        <div className="flex flex-col gap-1 text-caption text-muted md:flex-row md:gap-4">
          <p>{t("marketing.footer.madeBy")}</p>
          <p>{t("marketing.footer.copyright", { year: String(new Date().getFullYear()) })}</p>
          <nav aria-label={t("marketing.footer.legal")} className="flex gap-4">
            <a href="/privacy" className="inline-flex min-h-11 items-center rounded-control underline-offset-4 hover:text-default hover:underline">
              {t("marketing.footer.privacy")}
            </a>
            <a href="/terms" className="inline-flex min-h-11 items-center rounded-control underline-offset-4 hover:text-default hover:underline">
              {t("marketing.footer.terms")}
            </a>
          </nav>
        </div>
      </div>
    </footer>
  );
}

export default function MarketingPage() {
  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-toast focus:rounded-control focus:bg-surface-raised focus:px-4 focus:py-2 focus:shadow-md"
      >
        {t("common.skipToContent")}
      </a>
      <div id="top" />
      <MarketingNav />
      <main id="content" tabIndex={-1}>
        <Hero />
        <Problem />
        <HowItWorks />
        <Groups />
        <Talk />
        <HumansOnly />
        <WhatItIsnt />
        <Faq />
        <Closing />
      </main>
      <Footer />
      <RevealObserver />
    </>
  );
}

