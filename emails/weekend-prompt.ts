import { t } from "@/lib/messages";
import { button, escapeHtml, layout, row, styles, textFooter, type Email, type Footer } from "./layout";
import type { EmailLinks } from "./types";

// The weekend prompt (PRD F7.2): Sunday morning, to members who haven't put
// in a good word in two weeks. One question, one button that opens Add.

export function weekendPromptEmail(links: EmailLinks): Email {
  const { origin } = links;
  const subject = t("email.weekend.subject");
  const href = `${origin}/list?add=1&ref=nudge_email`;
  const footer: Footer = {
    why: t("email.weekend.why"),
    unsubscribe: { label: t("email.weekend.unsubscribe"), href: links.unsubscribe },
    settings: { label: t("email.settings"), href: `${origin}/you/settings` },
  };
  const rows = [
    row(`<p style="${styles.heading}margin:0;">${escapeHtml(subject)}</p>`, "0 0 12px 0"),
    row(`<p style="${styles.text}margin:0;">${escapeHtml(t("email.weekend.body"))}</p>`, "0 0 12px 0"),
    row(button(t("email.weekend.button"), href), "12px 0 32px 0"),
  ];
  const text = [subject, "", t("email.weekend.body"), "", `${t("email.weekend.button")}: ${href}`, "", textFooter(footer)].join("\n");
  return { subject, html: layout({ title: subject, preheader: t("email.weekend.body"), rows, footer }), text };
}
