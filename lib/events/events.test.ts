import { describe, expect, it } from "vitest";
import { EVENTS, cleanProps, isEventName, lengthBucket } from "./schema";
import { filterKeys } from "./shelf";

// Event schema (PRD 11.1, 11.2): only known events, only their properties,
// and never text that could hold a note, a search, or an email address.

describe("event schema", () => {
  it("covers every event in PRD 11.2", () => {
    expect(Object.keys(EVENTS).sort()).toEqual(
      [
        "invite_link_opened", "invite_shared", "group_created", "group_joined", "sign_in_completed", "add_opened",
        "search_performed", "good_word_created", "good_word_edited", "good_word_taken_back", "shelf_viewed", "title_viewed",
        "where_to_watch_clicked", "email_sent", "email_clicked", "notification_pref_changed", "first_good_word_prompt",
        "conversation_opened", "comment_created", "comment_edited", "comment_deleted", "mention_notified", "activity_opened",
        "spoiler_revealed", "share_link_toggled", "import_started", "import_parsed", "import_card_decided", "import_finished",
      ].sort(),
    );
  });

  it("has no free-text properties anywhere", () => {
    for (const [name, def] of Object.entries(EVENTS)) {
      for (const [key, kind] of Object.entries(def.props)) {
        expect(["uuid", "bool", "int", "keys"].includes(kind as string) || Array.isArray(kind), `${name}.${key}`).toBe(true);
        expect(key, `${name}.${key}`).not.toMatch(/^(note|query|email|body|text|name|message|title)$/);
      }
    }
  });

  it("keeps allowed properties with the right types and drops the rest", () => {
    expect(
      cleanProps("good_word_created", {
        title_id: "11111111-1111-4111-8111-111111111111",
        groups_count: 2.4,
        has_note: true,
        source: "digest",
        ms_from_add_opened: 6200,
        note: "ep 3 is where it gets you",
      }),
    ).toEqual({ title_id: "11111111-1111-4111-8111-111111111111", groups_count: 2, has_note: true, source: "digest", ms_from_add_opened: 6200 });
    expect(cleanProps("good_word_created", { source: "tiktok", has_note: "yes", title_id: "not-a-uuid" })).toEqual({});
    expect(cleanProps("search_performed", { query: "the night ferry", query_length: 15, result_count: -3 })).toEqual({ query_length: 15, result_count: 0 });
  });

  it("records filter names only, never their values", () => {
    expect(cleanProps("shelf_viewed", { shelf: "group", filters: ["genres", "type", "genres", "Comedy!", "x".repeat(30)], new_count: 3 })).toEqual({
      shelf: "group",
      filters: ["genres", "type"],
      new_count: 3,
    });
    expect(filterKeys({ genres: "35", type: "movie", q: "secret", sort: undefined })).toEqual(["type", "genres"]);
  });

  it("knows which events the browser may send", () => {
    expect(isEventName("add_opened") && EVENTS.add_opened.client).toBe(true);
    expect(isEventName("good_word_created") && EVENTS.good_word_created.client).toBe(false);
    expect(isEventName("__proto__")).toBe(false);
    expect(isEventName("drop_table")).toBe(false);
  });

  it("buckets comment length instead of recording text", () => {
    expect(lengthBucket(10)).toBe("short");
    expect(lengthBucket(120)).toBe("medium");
    expect(lengthBucket(400)).toBe("long");
  });
});
