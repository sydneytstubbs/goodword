// All UI copy comes from messages/en.json (DESIGN-SYSTEM.md 10). One language
// for now, keyed so more can be added without touching components.
import { Fragment, createElement, type ReactNode } from "react";
import en from "@/messages/en.json";

type Messages = typeof en;

// "a.b" paths to every string, with plural suffixes (_one, _other) folded away.
type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K extends `${infer Base}_${"one" | "other"}` ? Base : K}`
    : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export type MessageKey = Paths<Messages>;
export type MessageVars = Record<string, string | number>;

const pluralRules = new Intl.PluralRules("en");
const numberFormat = new Intl.NumberFormat("en");

function lookup(path: string): string | undefined {
  let node: unknown = en;
  for (const part of path.split(".")) {
    if (node && typeof node === "object" && part in node) node = (node as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof node === "string" ? node : undefined;
}

function resolve(key: string, vars?: MessageVars): string {
  const count = vars?.count;
  if (typeof count === "number") {
    const plural = lookup(`${key}_${pluralRules.select(count)}`) ?? lookup(`${key}_other`);
    if (plural) return plural;
  }
  const message = lookup(key);
  if (message === undefined) throw new Error(`Missing message: ${key}`);
  return message;
}

function interpolate(message: string, vars?: MessageVars): string {
  if (!vars) return message;
  return message.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    if (value === undefined) return match;
    return typeof value === "number" ? numberFormat.format(value) : value;
  });
}

/** Translate a key. Numbers are formatted; `count` picks the plural form. */
export function t(key: MessageKey, vars?: MessageVars): string {
  return interpolate(resolve(key, vars), vars);
}

/** Like t(), but renders <b>…</b> as <strong> and <em>…</em> as <em>. */
export function tRich(key: MessageKey, vars?: MessageVars): ReactNode {
  const text = t(key, vars);
  const parts = text.split(/(<b>.*?<\/b>|<em>.*?<\/em>)/g).filter(Boolean);
  return parts.map((part, i) => {
    const bold = part.match(/^<b>(.*)<\/b>$/);
    if (bold) return createElement("strong", { key: i, className: "font-semibold" }, bold[1]);
    const italic = part.match(/^<em>(.*)<\/em>$/);
    if (italic) return createElement("em", { key: i, className: "italic" }, italic[1]);
    return createElement(Fragment, { key: i }, part);
  });
}

/** Plain-text version of a rich message, for accessible names and previews. */
export function tPlain(key: MessageKey, vars?: MessageVars): string {
  return t(key, vars).replace(/<\/?(?:b|em)>/g, "");
}
