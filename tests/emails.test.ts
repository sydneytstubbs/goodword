import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { digestEmail } from "@/emails/digest";
import { groupJoinEmail } from "@/emails/group-join";
import { mentionEmail } from "@/emails/mention";
import { palette } from "@/emails/palette";
import type { DigestContent, EmailTitle, MentionBatch } from "@/emails/types";
import { runEmailJob } from "@/lib/email/job";
import { emailJobSecret, readUnsubscribeToken, unsubscribeToken } from "@/lib/email/secrets";
import { isReservedAddress, type OutgoingEmail } from "@/lib/email/send";
import { emailJobSecret as scriptSecret } from "../scripts/email-setup.mjs";

// Email (PRD F7): templates, links, spoilers, tokens, and the job's claim and
// release. Invented titles, people, and groups only.

process.env.SUPABASE_SERVICE_ROLE_KEY ??= "test-service-role-key";

const ORIGIN = "https://goodword.test";
const LINKS = { origin: ORIGIN, unsubscribe: `${ORIGIN}/unsubscribe?token=abc` };
const CREW = "11111111-1111-4111-8111-111111111111";
const GIRLS = "22222222-2222-4222-8222-222222222222";

const title = (name: string, tmdb: number, extra: Partial<EmailTitle> = {}): EmailTitle => ({
  id: `00000000-0000-4000-8000-${String(tmdb).padStart(12, "0")}`,
  tmdb_id: tmdb,
  type: "tv",
  title: name,
  year: 2024,
  poster_path: `/poster-${tmdb}.jpg`,
  accent: "moss",
  ...extra,
});

function digest(overrides: Partial<DigestContent> = {}): DigestContent {
  return {
    good_words: 3,
    group_names: ["College crew", "The girls"],
    groups: [
      {
        id: CREW,
        name: "College crew",
        total: 2,
        titles: [
          { ...title("The Night Ferry", 101), vouchers: ["Priya", "Jonah"], note: "ep 3 is where it gets you" },
          { ...title("Moth Season", 102, { type: "movie", poster_path: null }), vouchers: ["Tess"], note: null },
        ],
        comments: 12,
        conversations: 3,
        top_conversations: [{ ...title("The Night Ferry", 101), comments: 7 }],
      },
    ],
    ...overrides,
  };
}

const hrefs = (html: string) => [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));

describe("palette", () => {
  it("matches the light-theme primitives in tokens.css", () => {
    const css = readFileSync("styles/tokens.css", "utf8");
    const names: Record<keyof typeof palette, string> = {
      white: "white",
      stone200: "stone-200",
      stone100: "stone-100",
      graphite: "graphite",
      ink: "ink",
      cobalt: "cobalt",
      cobalt600: "cobalt-600",
      clay: "clay",
      ochre: "ochre",
      moss: "moss",
      plum: "plum",
    };
    for (const [key, token] of Object.entries(names)) {
      const match = css.match(new RegExp(`--${token}:\\s*(#[0-9A-Fa-f]{6})`));
      expect(match?.[1].toUpperCase(), token).toBe(palette[key as keyof typeof palette]);
    }
  });
});

describe("weekly digest", () => {
  it("counts good words in the subject, singular and plural", () => {
    expect(digestEmail(digest(), LINKS).subject).toBe("This week on Good Word: 3 new good words");
    expect(digestEmail(digest({ good_words: 1 }), LINKS).subject).toBe("This week on Good Word: 1 new good word");
  });

  it("names who vouched, shows notes, and summarizes conversations", () => {
    const { html, text } = digestEmail(digest(), LINKS);
    expect(html).toContain("Priya and Jonah vouched for this");
    expect(html).toContain("ep 3 is where it gets you");
    expect(html).toContain("12 new comments on 3 titles");
    expect(html).toContain("7 comments");
    expect(text).toContain("The Night Ferry");
    expect(text).toContain("Moth Season");
    expect(text).toContain("12 new comments on 3 titles");
  });

  it("links every title and conversation with ref=digest", () => {
    const links = hrefs(digestEmail(digest(), LINKS).html).filter((h) => h.startsWith(ORIGIN) && !h.includes("unsubscribe") && !h.includes("/you/settings"));
    expect(links).toContain(`${ORIGIN}/title/tv/101?ref=digest`);
    expect(links).toContain(`${ORIGIN}/title/movie/102?ref=digest`);
    expect(links).toContain(`${ORIGIN}/title/tv/101/conversation?group=${CREW}&ref=digest`);
    expect(links).toContain(`${ORIGIN}/shelf?ref=digest`);
    for (const link of links) expect(new URL(link).searchParams.get("ref")).toBe("digest");
  });

  it("has alt text on posters and a stand-in without one", () => {
    const { html } = digestEmail(digest(), LINKS);
    expect(html).toContain('alt="The Night Ferry"');
    expect(html).toContain('role="img" aria-label="Moth Season"');
  });

  it('shows "See all" only when there are more than it lists', () => {
    expect(digestEmail(digest(), LINKS).html).not.toContain("See all");
    const more = digest();
    more.groups[0].total = 11;
    const { html } = digestEmail(more, LINKS);
    expect(html).toContain("See all 11 in College crew");
    expect(hrefs(html)).toContain(`${ORIGIN}/shelf/${CREW}?ref=digest`);
  });

  it("says why you got it, with unsubscribe and settings links", () => {
    const { html, text } = digestEmail(digest(), LINKS);
    expect(html).toContain("because you&#39;re in College crew and The girls on Good Word");
    expect(hrefs(html)).toContain(LINKS.unsubscribe);
    expect(hrefs(html)).toContain(`${ORIGIN}/you/settings`);
    expect(text).toContain(`Unsubscribe from the weekly digest: ${LINKS.unsubscribe}`);
  });

  it("escapes what people wrote", () => {
    const hostile = digest();
    hostile.groups[0].name = "<b>crew</b>";
    hostile.groups[0].titles[0].note = '<img src=x onerror="alert(1)">';
    const { html } = digestEmail(hostile, LINKS);
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<b>crew</b>");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("uses no exclamation marks in our copy", () => {
    const { subject, text } = digestEmail(digest(), LINKS);
    expect(subject + text).not.toContain("!");
  });
});

describe("mention email", () => {
  const batch = (comments: MentionBatch["comments"]): MentionBatch => ({
    group_id: CREW,
    group_name: "College crew",
    title: title("Low Tide Club", 201),
    comments,
  });

  it("names who mentioned you and on what", () => {
    const one = mentionEmail(batch([{ id: "c1", author: "Priya", body: "@Mo you'd love this", is_spoiler: false, created_at: "" }]), LINKS);
    expect(one.subject).toBe("Priya mentioned you on Low Tide Club");
    const two = mentionEmail(
      batch([
        { id: "c1", author: "Priya", body: "@Mo look", is_spoiler: false, created_at: "" },
        { id: "c2", author: "Jonah", body: "@Mo and this", is_spoiler: false, created_at: "" },
        { id: "c3", author: "Priya", body: "@Mo again", is_spoiler: false, created_at: "" },
      ]),
      LINKS,
    );
    expect(two.subject).toBe("Priya and Jonah mentioned you on Low Tide Club");
    expect(two.html).toContain("In College crew");
  });

  it("lands on the first mentioning comment", () => {
    const { html } = mentionEmail(batch([{ id: "c1", author: "Priya", body: "@Mo hi", is_spoiler: false, created_at: "" }]), LINKS);
    expect(hrefs(html)).toContain(`${ORIGIN}/title/tv/201/conversation?group=${CREW}&comment=c1`);
  });

  it("never shows a spoiler's text", () => {
    const { html, text } = mentionEmail(
      batch([{ id: "c1", author: "Priya", body: "the ferry sinks in ep 6", is_spoiler: true, created_at: "" }]),
      LINKS,
    );
    expect(html).not.toContain("ferry sinks");
    expect(text).not.toContain("ferry sinks");
    expect(html).toContain("a spoiler comment");
  });
});

describe("group join email", () => {
  it("says who joined which group", () => {
    const one = groupJoinEmail([{ group_id: CREW, group_name: "College crew", name: "Jonah", at: "" }], LINKS);
    expect(one.subject).toBe("Jonah joined College crew");
    expect(one.text).toContain("Jonah joined College crew.");
    expect(hrefs(one.html)).toContain(`${ORIGIN}/groups/${CREW}`);

    const many = groupJoinEmail(
      [
        { group_id: CREW, group_name: "College crew", name: "Jonah", at: "" },
        { group_id: CREW, group_name: "College crew", name: "Tess", at: "" },
        { group_id: GIRLS, group_name: "The girls", name: "Bea", at: "" },
      ],
      LINKS,
    );
    expect(many.subject).toBe("Jonah, Tess, and Bea joined your groups");
    expect(many.text).toContain("Jonah and Tess joined College crew.");
    expect(many.text).toContain("Bea joined The girls.");
  });
});

describe("tokens and secrets", () => {
  const user = "33333333-3333-4333-8333-333333333333";

  it("round-trips an unsubscribe token", () => {
    expect(readUnsubscribeToken(unsubscribeToken(user, "digest"))).toEqual({ userId: user, pref: "digest" });
  });

  it("rejects tampered, truncated, or foreign tokens", () => {
    const token = unsubscribeToken(user, "digest");
    const other = "44444444-4444-4444-8444-444444444444";
    expect(readUnsubscribeToken(token.replace(user, other))).toBeNull();
    expect(readUnsubscribeToken(token.replace("digest", "mention_email"))).toBeNull();
    expect(readUnsubscribeToken(token.slice(0, -4))).toBeNull();
    expect(readUnsubscribeToken(`${user}.weekend_prompt.${token.split(".")[2]}`)).toBeNull();
    expect(readUnsubscribeToken("")).toBeNull();
    expect(readUnsubscribeToken(null)).toBeNull();
  });

  it("derives the job secret the same way as the setup script", () => {
    expect(scriptSecret(process.env.SUPABASE_SERVICE_ROLE_KEY)).toBe(emailJobSecret());
  });

  it("never sends to reserved test domains", () => {
    expect(isReservedAddress("mo-1234@example.com")).toBe(true);
    expect(isReservedAddress("bea@mail.example.org")).toBe(true);
    expect(isReservedAddress("tess@goodword.test")).toBe(true);
    expect(isReservedAddress("nobody")).toBe(true);
    expect(isReservedAddress("priya@gmail.com")).toBe(false);
  });
});

// A stand-in for the service-role client: the due lists, and a record of
// claims, releases, and log writes.
function fakeAdmin(due: { digests?: unknown[]; mentions?: unknown[]; joins?: unknown[] }, claimable = true) {
  const calls: string[] = [];
  const logged: unknown[] = [];
  const admin = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push(name);
      if (name === "email_digests_due") return { data: due.digests ?? [], error: null };
      if (name === "email_mentions_due") return { data: due.mentions ?? [], error: null };
      if (name === "email_joins_due") return { data: due.joins ?? [], error: null };
      if (name === "claim_email_items") return { data: claimable, error: null };
      if (name === "release_email_items") return { data: null, error: null, args };
      throw new Error(name);
    },
    from: () => ({
      insert: async (row: unknown) => {
        logged.push(row);
        return { error: null };
      },
      delete: () => ({
        match: async (row: unknown) => {
          calls.push(`unlog:${JSON.stringify(row)}`);
          return { error: null };
        },
      }),
    }),
  };
  return { admin: admin as never, calls, logged };
}

describe("the email job", () => {
  const mentionRow = {
    user_id: "55555555-5555-4555-8555-555555555555",
    email: "mo@goodwordfriends.com",
    item_ids: ["a1", "a2"],
    group_id: CREW,
    group_name: "College crew",
    title: title("Grandma's Heist", 301),
    comments: [{ id: "c1", author: "Luis", body: "@Mo this one", is_spoiler: false, created_at: "" }],
  };

  it("claims, sends, and logs a mention batch", async () => {
    const { admin, calls, logged } = fakeAdmin({ mentions: [mentionRow] });
    const sent: OutgoingEmail[] = [];
    const result = await runEmailJob({ admin, origin: ORIGIN, pauseMs: 0, send: async (e) => (sent.push(e), { ok: true }) });
    expect(result.mentions).toBe(1);
    expect(calls).toContain("claim_email_items");
    expect(calls).not.toContain("release_email_items");
    expect(sent[0].subject).toBe("Luis mentioned you on Grandma's Heist");
    expect(sent[0].oneClickUnsubscribe).toMatch(/^https:\/\/goodword\.test\/api\/unsubscribe\?token=/);
    expect(readUnsubscribeToken(decodeURIComponent(sent[0].oneClickUnsubscribe.split("token=")[1]))?.pref).toBe("mention_email");
    expect(logged).toContainEqual({ user_id: mentionRow.user_id, type: "mention", payload_ref: "a1" });
  });

  it("releases the claim when sending fails, so the next run retries", async () => {
    const { admin, calls, logged } = fakeAdmin({ mentions: [mentionRow] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await runEmailJob({ admin, origin: ORIGIN, pauseMs: 0, send: async () => ({ ok: false, error: "down" }) });
    expect(result.failed).toBe(1);
    expect(calls).toContain("release_email_items");
    expect(logged).toEqual([]);
  });

  it("skips what another run already claimed", async () => {
    const { admin } = fakeAdmin({ mentions: [mentionRow] }, false);
    const send = vi.fn();
    await runEmailJob({ admin, origin: ORIGIN, pauseMs: 0, send });
    expect(send).not.toHaveBeenCalled();
  });

  it("sends digests before join emails, so the daily cap favors the digest", async () => {
    const { admin, calls } = fakeAdmin({});
    await runEmailJob({ admin, origin: ORIGIN, pauseMs: 0, send: async () => ({ ok: true }) });
    expect(calls.indexOf("email_digests_due")).toBeLessThan(calls.indexOf("email_joins_due"));
  });

  it("logs a digest before sending and removes the log if it fails", async () => {
    const row = { user_id: mentionRow.user_id, email: mentionRow.email, slot: "2026-10-01", content: digest() };
    const { admin, calls, logged } = fakeAdmin({ digests: [row] });
    vi.spyOn(console, "error").mockImplementation(() => {});
    await runEmailJob({ admin, origin: ORIGIN, pauseMs: 0, send: async () => ({ ok: false, error: "down" }) });
    expect(logged).toContainEqual({ user_id: row.user_id, type: "digest", payload_ref: "2026-10-01" });
    expect(calls.some((c) => c.startsWith("unlog:"))).toBe(true);
  });
});
