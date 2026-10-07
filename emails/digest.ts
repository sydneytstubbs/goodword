import { conversationHref } from "@/lib/conversations/paths";
import { nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { button, escapeHtml, layout, row, styles, textFooter, type Email, type Footer } from "./layout";
import { posterRow, titleHref } from "./parts";
import type { DigestContent, EmailLinks } from "./types";

// The weekly digest (PRD F7.1, F7.5, F16.9): what Home shows. Up to 8 titles
// from friends and groups, newest first, each once, with who vouched, the
// newest note, and the group only when that's how it reached you; friends'
// imports as one line each; "See all N on Home" when there are more; then
// each group's conversation summary, which never shows comment text. Every
// link carries ref=digest, so good words put in from that visit record it.

const REF = { ref: "digest" };

export function digestEmail(content: DigestContent, links: EmailLinks): Email {
  const { origin } = links;
  const subject = t("email.digest.subject", { count: content.good_words });
  const vouchers = [...new Set(content.titles.flatMap((title) => title.vouchers))];
  const preheader = vouchers.length > 0 ? t("email.digest.preheader", { names: nameList(vouchers) }) : t("email.digest.heading");
  const footer: Footer = {
    why: t("email.digest.why"),
    unsubscribe: { label: t("email.digest.unsubscribe"), href: links.unsubscribe },
    settings: { label: t("email.settings"), href: `${origin}/you/settings` },
  };
  const homeHref = `${origin}/home?${new URLSearchParams(REF)}`;

  const rows: string[] = [row(`<h1 style="${styles.heading}margin:0;">${escapeHtml(t("email.digest.heading"))}</h1>`)];
  const text: string[] = [t("email.digest.heading"), ""];

  for (const title of content.titles) {
    const href = titleHref(origin, title, REF);
    const vouched = t("email.digest.vouched", { names: nameList(title.vouchers) });
    const where = title.group ? t("email.digest.inGroup", { group: title.group.name }) : null;
    const lines = [
      `<a href="${escapeHtml(href)}" style="${styles.titleLink}${styles.text}">${escapeHtml(title.title)}</a>`,
      `<div style="${styles.small}">${escapeHtml(vouched)}</div>`,
    ];
    if (where) lines.push(`<div style="${styles.small}">${escapeHtml(where)}</div>`);
    if (title.note) lines.push(`<div style="${styles.text}padding-top:4px;">${escapeHtml(title.note)}</div>`);
    rows.push(row(posterRow(title, lines.join("")), "0 0 16px 0"));
    text.push(title.title, vouched, ...(where ? [where] : []), ...(title.note ? [title.note] : []), href, "");
  }

  for (const rollup of content.rollups) {
    const line = t("email.digest.rollup", { name: rollup.name, count: rollup.count });
    rows.push(row(`<div style="${styles.text}">${escapeHtml(line)}</div>`, "0 0 16px 0"));
    text.push(line, "");
  }

  if (content.total_titles > content.titles.length) {
    const seeAll = t("email.digest.seeAllHome", { count: content.total_titles });
    rows.push(row(`<a href="${escapeHtml(homeHref)}" style="${styles.small}${styles.link}">${escapeHtml(seeAll)}</a>`, "0 0 24px 0"));
    text.push(`${seeAll}: ${homeHref}`, "");
  }

  for (const group of content.groups) {
    if (group.comments === 0) continue;
    const summary = t("email.digest.groupConversations", {
      group: group.name,
      comments: t("email.digest.comments", { count: group.comments }),
      titles: t("email.digest.titles", { count: group.conversations }),
    });
    const items = group.top_conversations.map((title) => ({
      title: title.title,
      count: t("email.digest.titleComments", { count: title.comments }),
      href: `${origin}${conversationHref({ type: title.type, tmdbId: title.tmdb_id }, group.id)}&${new URLSearchParams(REF)}`,
    }));
    const itemHtml = items.map(
      (i) => `<div style="${styles.small}"><a href="${escapeHtml(i.href)}" style="${styles.link}">${escapeHtml(i.title)}</a> · ${escapeHtml(i.count)}</div>`,
    );
    rows.push(row(`<div style="${styles.text}font-size:15px;">${escapeHtml(summary)}</div>${itemHtml.join("")}`, "0 0 24px 0"));
    text.push(summary, ...items.map((i) => `${i.title} · ${i.count}: ${i.href}`), "");
  }

  rows.push(row(button(t("email.digest.open"), homeHref), "8px 0 32px 0"));
  text.push(`${t("email.digest.open")}: ${homeHref}`, "", textFooter(footer));

  return { subject, html: layout({ title: subject, preheader, rows, footer }), text: text.join("\n") };
}
