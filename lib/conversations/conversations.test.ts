import { describe, expect, it } from "vitest";
import type { Title } from "@/components/domain/types";
import { activitySection, collapseActivity, unreadCount, type ActivityRecord } from "./activity";
import { decodeBody, encodeBody, mentionedIds, plainText, trimSegments } from "./body";

const priya = { id: "11111111-1111-4111-8111-111111111111", name: "Priya" };
const jonah = { id: "22222222-2222-4222-8222-222222222222", name: "Jonah" };
const tess = { id: "33333333-3333-4333-8333-333333333333", name: "Tess" };

describe("comment bodies", () => {
  it("stores mentions by id and reads them back with names", () => {
    const segments = [
      { kind: "text" as const, text: "just finished ep 6, " },
      { kind: "mention" as const, userId: priya.id, name: "Priya" },
      { kind: "text" as const, text: " you were SO right" },
    ];
    const stored = encodeBody(segments);
    expect(stored).toBe(`just finished ep 6, <@${priya.id}> you were SO right`);
    expect(decodeBody(stored, [priya])).toEqual(segments);
  });

  it("uses the current name, so renamed people resolve correctly", () => {
    expect(decodeBody(`<@${priya.id}>`, [{ id: priya.id, name: "Priya S" }])).toEqual([
      { kind: "mention", userId: priya.id, name: "Priya S" },
    ]);
  });

  it("reads an unknown mention as plain @ and merges it into the text", () => {
    expect(decodeBody(`hi <@${jonah.id}> there`, [])).toEqual([{ kind: "text", text: "hi @ there" }]);
  });

  it("leaves text that only looks like a mention alone", () => {
    expect(decodeBody("<@not-an-id> and @Priya", [priya])).toEqual([{ kind: "text", text: "<@not-an-id> and @Priya" }]);
  });

  it("keeps line breaks, trims the ends, and lists each mention once", () => {
    const segments = trimSegments([
      { kind: "text", text: "  \nline one\nline two " },
      { kind: "mention", userId: tess.id, name: "Tess" },
      { kind: "text", text: " " },
      { kind: "mention", userId: tess.id, name: "Tess" },
      { kind: "text", text: "   " },
    ]);
    expect(plainText(segments)).toBe("line one\nline two @Tess @Tess");
    expect(mentionedIds(segments)).toEqual([tess.id]);
  });
});

describe("Activity", () => {
  const ferry: Title = { id: "tv-1", type: "tv", tmdbId: 1, name: "The Night Ferry", genres: [], accent: "plum" };
  const moth: Title = { id: "movie-2", type: "movie", tmdbId: 2, name: "Moth Season", genres: [], accent: "clay" };
  const crew = { id: "g1", name: "College crew" };
  const at = (minutesAgo: number) => new Date(Date.UTC(2026, 8, 29, 18, 0) - minutesAgo * 60_000);
  let n = 0;
  const item = (over: Partial<ActivityRecord>): ActivityRecord => ({
    id: `a${++n}`,
    type: "comment",
    actor: jonah,
    group: crew,
    title: ferry,
    commentId: `c${n}`,
    spoiler: false,
    at: at(0),
    read: false,
    ...over,
  });

  it("collapses comments on one conversation within an hour, naming each person once", () => {
    const entries = collapseActivity([
      item({ actor: tess, at: at(5), commentId: "latest" }),
      item({ actor: jonah, at: at(30) }),
      item({ actor: tess, at: at(50), commentId: "earliest", read: true }),
    ]);
    expect(entries).toHaveLength(1);
    expect(entries[0].actors.map((a) => a.name)).toEqual(["Tess", "Jonah"]);
    expect(entries[0].commentId).toBe("earliest");
    expect(entries[0].ids).toHaveLength(3);
    expect(entries[0].unread).toBe(true);
  });

  it("chains runs as long as each comment is within an hour of the last", () => {
    const entries = collapseActivity([item({ at: at(0) }), item({ at: at(50) }), item({ at: at(100) }), item({ at: at(200) })]);
    expect(entries.map((e) => e.ids.length)).toEqual([3, 1]);
  });

  it("keeps mentions, other conversations, and joins separate", () => {
    const entries = collapseActivity([
      item({ at: at(1) }),
      item({ at: at(2), type: "mention", actor: priya }),
      item({ at: at(3) }),
      item({ at: at(4), title: moth }),
      item({ at: at(5), type: "group_join", title: undefined, commentId: undefined, actor: tess }),
    ]);
    expect(entries.map((e) => e.type)).toEqual(["comment", "mention", "comment", "comment", "group_join"]);
  });

  it("counts unread entries for the bell", () => {
    const entries = collapseActivity([item({ at: at(1) }), item({ at: at(2) }), item({ at: at(3), type: "mention" }), item({ at: at(400), read: true })]);
    expect(unreadCount(entries)).toBe(2);
  });

  it("groups by Today, This week, and Earlier", () => {
    const now = new Date(2026, 8, 29, 18, 0);
    expect(activitySection(new Date(2026, 8, 29, 0, 5), now)).toBe("today");
    expect(activitySection(new Date(2026, 8, 28, 23, 0), now)).toBe("week");
    expect(activitySection(new Date(2026, 8, 23, 1, 0), now)).toBe("week");
    expect(activitySection(new Date(2026, 8, 22, 23, 0), now)).toBe("earlier");
  });
});
