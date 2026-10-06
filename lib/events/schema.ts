// The events Good Word records (PRD 11.2), and what each may carry. Every
// event is checked against this before it's stored: unknown events and
// properties are dropped, so search text, notes, and email addresses can
// never end up in the events table (PRD 11.1). `client: true` events may
// come from the browser through /api/events; the rest are recorded on the
// server where they happen.

type Prop = "uuid" | "bool" | "int" | "keys" | readonly string[];

type Definition = { client: boolean; props: Record<string, Prop> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const EVENTS = {
  invite_link_opened: { client: false, props: { kind: ["group", "friend"], group_id: "uuid", signed_in: "bool" } },
  invite_shared: { client: true, props: { group_id: "uuid", method: ["share_sheet", "copy"] } },
  group_created: { client: false, props: { group_id: "uuid" } },
  group_joined: { client: false, props: { group_id: "uuid", via: ["invite"] } },
  sign_in_completed: { client: false, props: { method: ["magic_link", "google"], new_user: "bool" } },
  add_opened: {
    client: true,
    props: { entry_point: ["tab", "rail", "shortcut", "title", "search_row", "join_prompt", "empty_state", "email"] },
  },
  search_performed: { client: false, props: { query_length: "int", result_count: "int" } },
  good_word_created: {
    client: false,
    props: {
      title_id: "uuid",
      groups_count: "int",
      has_note: "bool",
      source: ["organic", "digest", "nudge_email", "join_prompt", "share", "import"],
      ms_from_add_opened: "int",
    },
  },
  good_word_edited: { client: false, props: { field: ["note", "groups"] } },
  good_word_taken_back: { client: false, props: { undone: "bool" } },
  list_viewed: { client: false, props: { list: ["group", "all", "mine", "person"], filters: "keys", new_count: "int" } },
  title_viewed: { client: false, props: { from: ["list", "search", "digest", "person", "share"] } },
  where_to_watch_clicked: { client: true, props: { title_id: "uuid", provider_id: "int", from_good_word: "bool" } },
  email_sent: { client: false, props: { type: ["digest", "mention", "group_join", "weekend_prompt"] } },
  email_clicked: { client: true, props: { type: ["digest", "mention", "group_join", "nudge_email"], target: ["title", "list", "conversation", "group", "other"] } },
  notification_pref_changed: { client: false, props: { type: ["digest", "mention_email", "group_joins", "weekend_prompt"], enabled: "bool" } },
  share_link_toggled: { client: false, props: { enabled: "bool" } },
  first_good_word_prompt: { client: true, props: { action: ["shown", "used", "dismissed"] } },
  conversation_opened: {
    client: false,
    props: { group_id: "uuid", title_id: "uuid", from: ["title", "card", "activity", "email"], unseen_count: "int" },
  },
  comment_created: {
    client: false,
    props: { group_id: "uuid", title_id: "uuid", length_bucket: ["short", "medium", "long"], mention_count: "int", is_spoiler: "bool" },
  },
  comment_edited: { client: false, props: {} },
  comment_deleted: { client: false, props: { undone: "bool" } },
  mention_notified: { client: false, props: { channel: ["activity", "email"] } },
  activity_opened: { client: false, props: { unread_count: "int" } },
  spoiler_revealed: { client: false, props: {} },
  friend_link_shared: { client: true, props: { method: ["share_sheet", "copy"] } },
  friend_request_sent: { client: false, props: { from: ["friends_screen", "group_prompt"] } },
  friend_added: { client: false, props: { via: ["link", "request", "seeded"] } },
  friend_removed: { client: false, props: {} },
  import_started: {
    client: false,
    props: { method: ["text", "screenshots", "both"], screenshot_count: "int", text_length_bucket: ["none", "short", "medium", "long"] },
  },
  import_parsed: {
    client: false,
    props: {
      found_count: "int",
      duplicate_count: "int",
      high_confidence_count: "int",
      ai_used: "bool",
      reused: "bool",
      ai_input_tokens: "int",
      ai_output_tokens: "int",
      ai_cost_microdollars: "int",
      ms_elapsed: "int",
    },
  },
  import_failed: {
    client: false,
    props: {
      stage: ["parse", "save"],
      reason: ["config", "auth", "rate_limited", "bad_request", "unavailable", "refused", "unparsed", "failed"],
    },
  },
  import_card_decided: { client: false, props: { decision: ["added", "skipped"], opened_alternatives: "bool", bulk: "bool" } },
  import_finished: { client: false, props: { added_count: "int", skipped_count: "int", duplicate_count: "int", ms_from_start: "int" } },
} as const satisfies Record<string, Definition>;

export type EventName = keyof typeof EVENTS;

type PropValue<P> = P extends "uuid" ? string : P extends "bool" ? boolean : P extends "int" ? number : P extends "keys" ? string[] : P extends readonly (infer V)[] ? V : never;

export type EventProps<N extends EventName> = { [K in keyof (typeof EVENTS)[N]["props"]]?: PropValue<(typeof EVENTS)[N]["props"][K]> };

export function isEventName(name: unknown): name is EventName {
  return typeof name === "string" && Object.hasOwn(EVENTS, name);
}

/** Keeps only the properties an event allows, with the right types. */
export function cleanProps(name: EventName, props: unknown): Record<string, unknown> {
  const allowed = EVENTS[name].props as Record<string, Prop>;
  const input = props && typeof props === "object" ? (props as Record<string, unknown>) : {};
  const out: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(allowed)) {
    const value = input[key];
    if (value === undefined || value === null) continue;
    if (kind === "uuid" && typeof value === "string" && UUID.test(value)) out[key] = value.toLowerCase();
    else if (kind === "bool" && typeof value === "boolean") out[key] = value;
    else if (kind === "int" && typeof value === "number" && Number.isFinite(value)) out[key] = Math.max(0, Math.min(Math.round(value), 2_147_483_647));
    else if (kind === "keys" && Array.isArray(value)) {
      // Filter names only, never their values (11.2): short lowercase keys.
      out[key] = [...new Set(value.filter((k): k is string => typeof k === "string" && /^[a-z_]{1,20}$/.test(k)))].slice(0, 10).sort();
    } else if (Array.isArray(kind) && typeof value === "string" && kind.includes(value)) out[key] = value;
  }
  return out;
}

/** A comment's length, bucketed so its text never needs recording. */
export function lengthBucket(length: number): "short" | "medium" | "long" {
  return length < 50 ? "short" : length <= 200 ? "medium" : "long";
}
