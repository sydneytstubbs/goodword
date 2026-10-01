// Reading a pasted or dictated list (PRD F15.2). Pure helpers, shared by the
// server pipeline and its tests. A list that's already one title per line is
// matched on TMDB directly; anything messier goes to the AI model.

export const MAX_TEXT = 5000;
export const MAX_SCREENSHOTS = 5;
export const MAX_TITLES = 100;
const MAX_QUERY = 200;
const MAX_NOTE = 140;

export type Candidate = {
  /** The title as written (or read), without commentary. */
  title: string;
  year: number | null;
  type: "movie" | "tv" | null;
  /** A reaction written alongside the title ("so good"). */
  note: string | null;
  /** The parser was sure this is a title (always true for clean lines). */
  confident: boolean;
};

const BULLET = /^\s*(?:[-*•·◦▪–—>]+|\d{1,3}[.)\]:]|\[[ xX]?\]|[a-zA-Z][.)](?=\s))\s*/u;
const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{20E3}\u{1F3FB}-\u{1F3FF}]/gu;
const YEAR_SUFFIX = /\s*[([]\s*((?:19|20)\d{2})\s*[)\]]\s*$/;

/** One line without bullets, numbering, checkboxes, emoji, or wrapping quotes. */
export function cleanLine(line: string): string {
  let s = line.replace(EMOJI, " ");
  // Bullets can stack ("- 1. "), so strip until nothing changes.
  for (let i = 0; i < 3; i++) s = s.replace(BULLET, "");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "").trim();
  return s;
}

/** True when a line reads like just a title (with an optional year), no commentary. */
export function isPlainTitle(line: string): boolean {
  const body = line.replace(YEAR_SUFFIX, "");
  if (!body || body.length > 80) return false;
  if (body.split(" ").length > 8) return false;
  // Commas, dashes, colons after a word, and parentheses usually mean a comment
  // ("Severance, so good", "Fleabag - season 2 especially").
  return !/[,;!?(]|\s[-–—]\s|\s{2}/.test(body) && !/[.]$/.test(body);
}

/** "The Night Ferry (2024)" to its title and year. */
export function splitYear(line: string): { title: string; year: number | null } {
  const match = line.match(YEAR_SUFFIX);
  if (!match) return { title: line, year: null };
  return { title: line.slice(0, match.index).trim(), year: Number(match[1]) };
}

export type SplitText = {
  /** Lines that read like a bare title: try TMDB first. */
  plain: Candidate[];
  /** Everything else, for the AI model. Empty when nothing's left over. */
  messy: string;
};

/**
 * Splits pasted text into bare-title lines and the rest. Text that isn't
 * line-shaped (a dictated paragraph) goes to the model whole.
 */
export function splitText(text: string): SplitText {
  const lines = text
    .slice(0, MAX_TEXT)
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);
  if (lines.length === 0) return { plain: [], messy: "" };
  const listShaped = lines.length >= 2 || isPlainTitle(lines[0]);
  if (!listShaped) return { plain: [], messy: lines.join("\n") };
  const plain: Candidate[] = [];
  const messy: string[] = [];
  for (const line of lines) {
    if (isPlainTitle(line)) {
      const { title, year } = splitYear(line);
      plain.push({ title: title.slice(0, MAX_QUERY), year, type: null, note: null, confident: true });
    } else messy.push(line);
  }
  return { plain, messy: messy.join("\n") };
}

/** For comparing titles: case, accents, "&", and punctuation don't matter. */
export function normalizeTitle(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/^(the|a|an) /, "")
    .trim();
}

/** The shared match cache's key (title_matches.query_key). */
export function matchKey(candidate: Pick<Candidate, "title" | "year" | "type">): string {
  return `${normalizeTitle(candidate.title)}|${candidate.year ?? ""}|${candidate.type ?? ""}`.slice(0, 240);
}

/** Tidies what the model returns, so a bad row can't reach the database. */
export function tidyCandidate(raw: {
  title: string;
  year: number | null;
  type: "movie" | "tv" | "unknown";
  note: string | null;
  confident: boolean;
}): Candidate | null {
  const title = cleanLine(raw.title).slice(0, MAX_QUERY);
  if (!title) return null;
  const year = raw.year && raw.year >= 1880 && raw.year <= 2100 ? Math.round(raw.year) : null;
  const note = raw.note ? cleanLine(raw.note).slice(0, MAX_NOTE) || null : null;
  return { title, year, type: raw.type === "unknown" ? null : raw.type, note, confident: raw.confident };
}

/** Bucket for import_started (never the text itself, PRD 11.1). */
export function lengthBucket(length: number): "none" | "short" | "medium" | "long" {
  if (length === 0) return "none";
  if (length < 300) return "short";
  if (length < 2000) return "medium";
  return "long";
}
