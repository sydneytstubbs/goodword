import { conversationHref } from "@/lib/conversations/paths";
import { joinList, nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { button, escapeHtml, layout, row, styles, textFooter, type Email, type Footer } from "./layout";
import { posterRow, titleHref } from "./parts";
import type { DigestContent, EmailLinks } from "./types";

// The weekly digest (PRD F7.1, F7.5). Grouped by group: up to 8 titles with
// who vouched and the latest note, "See all N in College crew" when there are
// more, then a conversation summary that never shows comment text. Every
// link carries ref=digest, so good words put in from that visit record it.

const REF = { ref: "digest" };

export function digestEmail(content: DigestContent, links: EmailLinks): Email {
  const { origin } = links;
  const subject = t("email.digest.subject", { count: content.good_words });
  const vouchers = [...new Set(content.groups.flatMap((g) => g.titles.flatMap((title) => title.vouchers)))];
  const preheader = t("email.digest.preheader", { names: nameList(vouchers) });
  const footer: Footer = {
    why: t("email.digest.why", { groups: joinList(content.group_names) }),
    unsubscribe: { label: t("email.digest.unsubscribe"), href: links.unsubscribe },
    settings: { label: t("email.settings"), href: `${origin}/you/settings` },
  };
  const openHref = `${origin}/shelf?${new URLSearchParams(REF)}`;

  const rows: string[] = [row(`<h1 style="${styles.heading}margin:0;">${escapeHtml(t("email.digest.heading"))}</h1>`)];
  const text: string[] = [t("email.digest.heading"), ""];

  for (const group of content.groups) {
    rows.push(row(`<h2 style="${styles.heading}font-size:19px;line-height:26px;margin:0;">${escapeHtml(group.name)}</h2>`, "8px 0 16px 0"));
    text.push(group.name.toUpperCase(), "");

    for (const title of group.titles) {
      const href = titleHref(origin, title, REF);
      const vouched = t("email.digest.vouched", { names: nameList(title.vouchers) });
      const lines = [
        `<a href="${escapeHtml(href)}" style="${styles.titleLink}${styles.text}">${escapeHtml(title.title)}</a>`,
        `<div style="${styles.small}">${escapeHtml(vouched)}</div>`,
      ];
      if (title.note) lines.push(`<div style="${styles.text}padding-top:4px;">${escapeHtml(title.note)}</div>`);
      rows.push(row(posterRow(title, lines.join("")), "0 0 16px 0"));
      text.push(title.title, vouched, ...(title.note ? [title.note] : []), href, "");
    }

    if (group.total > group.titles.length) {
      const seeAll = t("email.digest.seeAll", { count: group.total, group: group.name });
      const href = `${origin}/shelf/${group.id}?${new URLSearchParams(REF)}`;
      rows.push(row(`<a href="${escapeHtml(href)}" style="${styles.small}${styles.link}">${escapeHtml(seeAll)}</a>`, "0 0 16px 0"));
      text.push(`${seeAll}: ${href}`, "");
    }

    if (group.comments > 0) {
      const summary = t("email.digest.conversations", {
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
  }

  rows.push(row(button(t("email.digest.open"), openHref), "8px 0 32px 0"));
  text.push(`${t("email.digest.open")}: ${openHref}`, "", textFooter(footer));

  return { subject, html: layout({ title: subject, preheader, rows, footer }), text: text.join("\n") };
}
