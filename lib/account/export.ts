import "server-only";
import { createClient } from "@/lib/supabase/server";

// Download my data (PRD F1): your profile, your groups, and your good words
// (title, note, groups, dates), as JSON. Read as you, under row-level
// security, so it can only ever hold what you can already see.

export type AccountExport = {
  exported_at: string;
  profile: { name: string | null; email: string | null; region: string; timezone: string | null; joined: string };
  groups: Array<{ name: string; role: string; joined: string }>;
  good_words: Array<{ title: string; type: string; year: number | null; note: string | null; groups: string[]; added: string }>;
};

type GoodWordRow = {
  note: string | null;
  created_at: string;
  titles: { title: string; media_type: string; year: number | null } | null;
  good_word_groups: Array<{ group_id: string }>;
};

export async function exportAccount(userId: string, email: string | null): Promise<AccountExport> {
  const supabase = await createClient();
  const [profile, memberships, goodWords] = await Promise.all([
    supabase.from("profiles").select("display_name, region, timezone, created_at").eq("user_id", userId).single(),
    supabase.from("group_members").select("role, joined_at, groups(id, name)").eq("user_id", userId).order("joined_at"),
    supabase
      .from("good_words")
      .select("note, created_at, titles(title, media_type, year), good_word_groups(group_id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  if (profile.error || memberships.error || goodWords.error) throw new Error("export failed");

  const groups = (memberships.data ?? []) as unknown as Array<{ role: string; joined_at: string; groups: { id: string; name: string } | null }>;
  const groupNames = new Map(groups.flatMap((m) => (m.groups ? [[m.groups.id, m.groups.name] as const] : [])));

  return {
    exported_at: new Date().toISOString(),
    profile: {
      name: profile.data.display_name,
      email,
      region: profile.data.region,
      timezone: profile.data.timezone,
      joined: profile.data.created_at,
    },
    groups: groups.flatMap((m) => (m.groups ? [{ name: m.groups.name, role: m.role, joined: m.joined_at }] : [])),
    good_words: ((goodWords.data ?? []) as unknown as GoodWordRow[]).map((g) => ({
      title: g.titles?.title ?? "",
      type: g.titles?.media_type === "tv" ? "series" : "film",
      year: g.titles?.year ?? null,
      note: g.note,
      groups: g.good_word_groups.flatMap((link) => groupNames.get(link.group_id) ?? []),
      added: g.created_at,
    })),
  };
}
