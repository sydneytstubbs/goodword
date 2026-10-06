import { joinList, nameList } from "@/lib/format";
import { t } from "@/lib/messages";
import { button, escapeHtml, layout, row, styles, textFooter, type Email, type Footer } from "./layout";
import type { EmailLinks, JoinBatch } from "./types";

// Someone joined your group (PRD F7.3): "Jonah joined College crew." One
// email a day at most, so it lists everyone since the last one, per group.

export function groupJoinEmail(joins: JoinBatch, links: EmailLinks): Email {
  const { origin } = links;
  const byGroup = new Map<string, { name: string; people: string[] }>();
  for (const join of joins) {
    const group = byGroup.get(join.group_id) ?? { name: join.group_name, people: [] };
    if (!group.people.includes(join.name)) group.people.push(join.name);
    byGroup.set(join.group_id, group);
  }
  const groups = [...byGroup.entries()];
  const everyone = [...new Set(joins.map((j) => j.name))];
  const subject =
    groups.length === 1
      ? t("email.groupJoin.subjectOne", { names: nameList(groups[0][1].people), group: groups[0][1].name })
      : t("email.groupJoin.subjectMany", { names: nameList(everyone) });
  const lines = groups.map(([, g]) => t("email.groupJoin.line", { names: nameList(g.people), group: g.name }));
  const href = `${groups.length === 1 ? `${origin}/groups/${groups[0][0]}` : `${origin}/list`}?ref=group_join`;
  const footer: Footer = {
    why: t("email.groupJoin.why", { groups: joinList(groups.map(([, g]) => g.name)) }),
    unsubscribe: { label: t("email.groupJoin.unsubscribe"), href: links.unsubscribe },
    settings: { label: t("email.settings"), href: `${origin}/you/settings` },
  };

  const rows = [
    ...lines.map((line, i) => row(`<p style="${i === 0 ? styles.heading : styles.text}margin:0;">${escapeHtml(line)}</p>`, "0 0 12px 0")),
    row(button(t("email.groupJoin.open"), href), "12px 0 32px 0"),
  ];
  const text = [...lines, "", `${t("email.groupJoin.open")}: ${href}`, "", textFooter(footer)].join("\n");
  return { subject, html: layout({ title: subject, preheader: lines.join(" "), rows, footer }), text };
}
