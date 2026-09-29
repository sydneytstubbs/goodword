import { posterSrc } from "@/lib/tmdb/images";
import { escapeHtml } from "./layout";
import { palette } from "./palette";
import type { EmailTitle } from "./types";

// Posters at 64×96 from TMDB's w154 size, with alt text (DS 5.13). Without a
// poster, a block in the title's genre accent stands in, as in the app.
export function poster(title: EmailTitle): string {
  if (title.poster_path) {
    return `<img src="${escapeHtml(posterSrc(title.poster_path, 154))}" width="64" height="96" alt="${escapeHtml(title.title)}" style="display:block;width:64px;height:96px;border-radius:6px;border:0;background:${palette.stone100};">`;
  }
  const color = palette[title.accent ?? "moss"];
  return `<div role="img" aria-label="${escapeHtml(title.title)}" style="width:64px;height:96px;border-radius:6px;background:${color};"></div>`;
}

/** Poster on the left, content on the right. `content` is already escaped. */
export function posterRow(title: EmailTitle, content: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
<td width="64" valign="top" style="padding-right:16px;">${poster(title)}</td>
<td valign="top">${content}</td>
</tr></table>`;
}

export function titleHref(origin: string, title: EmailTitle, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `${origin}/title/${title.type}/${title.tmdb_id}${query ? `?${query}` : ""}`;
}
