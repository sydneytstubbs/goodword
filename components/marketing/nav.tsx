"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { cn } from "@/lib/cn";
import { t } from "@/lib/messages";
import { Wordmark } from "../domain/wordmark";
import { useModal } from "../ui/use-modal";

// Marketing nav (spec 6.1). Sticky; transparent at the top, then solid
// surface with a hairline once the page scrolls (no blur). Below 768px, a "Menu"
// text button opens a full-screen overlay of the links, closed with "Close"
// or Esc; focus is trapped while it's open.

const LINKS = [
  { id: "how-it-works", label: () => t("marketing.nav.howItWorks") },
  { id: "groups", label: () => t("marketing.nav.groups") },
  { id: "talk", label: () => t("marketing.nav.talk") },
  { id: "faq", label: () => t("marketing.nav.faq") },
];

export function ComingSoon({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span aria-hidden="true" className="size-1.5 rounded-pill bg-action fc-edge" />
      {t("marketing.nav.comingSoon")}
    </span>
  );
}

function goTo(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.scrollIntoView();
  target.focus({ preventScroll: true });
  history.replaceState(null, "", `#${id}`);
}

export function MarketingNav() {
  const header = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { dialogProps } = useModal({ open: menuOpen, onClose: () => setMenuOpen(false) });

  useEffect(() => {
    const el = header.current;
    if (!el) return;
    const update = () => {
      if (window.scrollY > 8) el.dataset.scrolled = "";
      else delete el.dataset.scrolled;
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  function onMenuLink(e: MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    setMenuOpen(false);
    // After the overlay has closed and returned focus, move to the section.
    setTimeout(() => goTo(id), 240);
  }

  return (
    <>
      <header
        ref={header}
        className="sticky top-0 z-nav border-b border-transparent transition duration-base ease-standard data-scrolled:border-subtle data-scrolled:bg-surface"
      >
        <div className="mx-auto flex h-16 max-w-marketing items-center justify-between gap-6 px-5 md:px-8 lg:px-10">
          <a href="#top" aria-label={t("marketing.nav.home")} className="rounded-control">
            <Wordmark />
          </a>
          <nav aria-label={t("marketing.nav.label")} className="hidden items-center gap-6 md:flex">
            <ul className="flex items-center gap-6">
              {LINKS.map((link) => (
                <li key={link.id}>
                  <a
                    href={`#${link.id}`}
                    className="inline-flex min-h-target items-center text-label text-default transition duration-fast ease-standard hover:text-action"
                  >
                    {link.label()}
                  </a>
                </li>
              ))}
            </ul>
            <ComingSoon className="text-caption text-muted" />
          </nav>
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
            className="-me-2 inline-flex min-h-target items-center rounded-control px-2 text-label font-semibold text-default md:hidden"
          >
            {t("marketing.nav.menu")}
          </button>
        </div>
      </header>

      <dialog
        {...dialogProps}
        aria-label={t("marketing.nav.label")}
        className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-surface p-0 text-default backdrop:bg-surface motion-ok:open:animate-fade-in motion-ok:data-closing:animate-fade-out"
      >
        <div className="flex h-full flex-col px-5 pt-safe">
          <div className="flex h-16 items-center justify-between">
            <Wordmark />
            <button
              type="button"
              data-autofocus
              onClick={() => setMenuOpen(false)}
              className="-me-2 inline-flex min-h-target items-center rounded-control px-2 text-label font-semibold text-default"
            >
              {t("marketing.nav.close")}
            </button>
          </div>
          <nav aria-label={t("marketing.nav.label")} className="mt-10">
            <ul className="flex flex-col gap-4">
              {LINKS.map((link) => (
                <li key={link.id}>
                  <a href={`#${link.id}`} onClick={(e) => onMenuLink(e, link.id)} className="text-display-l text-default">
                    {link.label()}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
          <ComingSoon className="mt-auto mb-10 text-overline text-muted" />
        </div>
      </dialog>
    </>
  );
}
