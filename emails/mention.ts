import { conversationHref } from "@/lib/conversations/paths";
import { nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { button, escapeHtml, layout, row, styles, textFooter, type Email, type Footer } from "./layout";
import { posterRow } from "./parts";
import type { EmailLinks, MentionBatch } from "./types";

// Mention email (PRD F7.4): one per conversation, naming who mentioned you
// and on what. Each mentioning comment is shown, except a spoiler, which
// only ever says "a spoiler comment" (DS 4.2.12). The button lands on the
// first mentioning comment.

export function mentionEmail(batch: MentionBatch, links: EmailLinks): Email {
  const { origin } = links;
  const names = nameList([...new Set(batch.comments.map((c) => c.author))]);
  const subject = t("email.mention.subject", { names, title: batch.title.title });
  const inGroup = t("email.mention.inGroup", { group: batch.group_name });
  const href = `${origin}${conversationHref({ type: batch.title.type, tmdbId: batch.title.tmdb_id }, batch.group_id, { comment: batch.comments[0]?.id })}`;
  const footer: Footer = {
    why: t("email.mention.why", { group: batch.group_name }),
    unsubscribe: { label: t("email.mention.unsubscribe"), href: links.unsubscribe },
    settings: { label: t("email.settings"), href: `${origin}/you/settings` },
  };

  const comments = batch.comments.map((c) => ({
    author: c.author,
    body: c.is_spoiler || c.body === null ? t("email.mention.spoiler") : c.body,
    spoiler: c.is_spoiler || c.body === null,
  }));

  const commentHtml = comments
    .map(
      (c) =>
        `<div style="${styles.text}padding-top:8px;"><strong>${escapeHtml(c.author)}</strong><br>${
          c.spoiler ? `<em style="color:inherit;">${escapeHtml(c.body)}</em>` : escapeHtml(c.body).replace(/\n/g, "<br>")
        }</div>`,
    )
    .join("");

  const rows = [
    row(`<h1 style="${styles.heading}margin:0;">${escapeHtml(subject)}</h1>`),
    row(posterRow(batch.title, `<div style="${styles.small}">${escapeHtml(inGroup)}</div>${commentHtml}`)),
    row(button(t("email.mention.open"), href), "8px 0 32px 0"),
  ];
  const text = [
    subject,
    inGroup,
    "",
    ...comments.flatMap((c) => [`${c.author}: ${c.body}`, ""]),
    `${t("email.mention.open")}: ${href}`,
    "",
    textFooter(footer),
  ].join("\n");

  return { subject, html: layout({ title: subject, preheader: comments[0] ? `${comments[0].author}: ${comments[0].body}` : inGroup, rows, footer }), text };
}
