import { fonts, palette } from "./palette";

// The shared shell for product email (PRD 9.4, DS 5.13): table layout for
// old clients, one column at 480px, a wordmark header, one cobalt button, and
// a footer that says why you got it with a one-click unsubscribe. Every email
// also has a plain-text version built from the same parts.

export type Email = { subject: string; html: string; text: string };

export type Footer = { why: string; unsubscribe: { label: string; href: string }; settings: { label: string; href: string } };

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const body = `font-family:${fonts.body};color:${palette.ink};`;
export const styles = {
  text: `${body}font-size:17px;line-height:26px;`,
  small: `font-family:${fonts.body};font-size:14px;line-height:22px;color:${palette.graphite};`,
  heading: `${body}font-size:22px;line-height:30px;font-weight:600;`,
  link: `color:${palette.cobalt600};text-decoration:underline;`,
  titleLink: `color:${palette.ink};text-decoration:none;font-weight:600;`,
} as const;

export function button(label: string, href: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${palette.cobalt};color:${palette.white};font-family:${fonts.body};font-size:17px;line-height:24px;font-weight:600;text-decoration:none;padding:12px 24px;border-radius:12px;">${escapeHtml(label)}</a>`;
}

/** A row in the main column. `html` is already escaped. */
export function row(html: string, padding = "0 0 24px 0"): string {
  return `<tr><td style="padding:${padding};">${html}</td></tr>`;
}

export function layout({ title, preheader, rows, footer }: { title: string; preheader: string; rows: string[]; footer: Footer }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${palette.white};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.white};">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;">
<tr><td style="font-family:${fonts.display};font-size:28px;line-height:36px;color:${palette.ink};padding-bottom:24px;">Good <em>Word</em></td></tr>
${rows.join("\n")}
<tr><td style="border-top:1px solid ${palette.stone200};padding-top:24px;${styles.small}">
${escapeHtml(footer.why)}<br>
<a href="${escapeHtml(footer.unsubscribe.href)}" style="${styles.link}color:${palette.graphite};">${escapeHtml(footer.unsubscribe.label)}</a> · <a href="${escapeHtml(footer.settings.href)}" style="${styles.link}color:${palette.graphite};">${escapeHtml(footer.settings.label)}</a>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

export function textFooter(footer: Footer): string {
  return [
    "--",
    footer.why,
    `${footer.unsubscribe.label}: ${footer.unsubscribe.href}`,
    `${footer.settings.label}: ${footer.settings.href}`,
  ].join("\n");
}
