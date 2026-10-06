import "server-only";
import { createClient } from "@/lib/supabase/server";

// Download my data (PRD F1): your profile, your groups, your good words
// (title, note, groups, dates), and your friends' names (F16.1), as JSON. Read as you, under row-level
// security, so it can only ever hold what you can already see.

export type AccountExport = {
  exported_at: string;
  profile: { name: string | null; email: string | null; region: string; timezone: string | null; joined: string };
  groups: Array<{ name: string; role: string; joined: string }>;
  friends: Array<{ name: string; since: string }>;
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
  const [profile, memberships, goodWords, friendships] = await Promise.all([
    supabase.from("profiles").select("display_name, region, timezone, created_at").eq("user_id", userId).single(),
    supabase.from("group_members").select("role, joined_at, groups(id, name)").eq("user_id", userId).order("joined_at"),
    supabase
      .from("good_words")
      .select("note, created_at, titles(title, media_type, year), good_word_groups(group_id)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    supabase
      .from("friendships")
      .select("user_low, user_high, accepted_at")
      .eq("status", "accepted")
      .or(`user_low.eq.${userId},user_high.eq.${userId}`)
      .order("accepted_at"),
  ]);
  if (profile.error || memberships.error || goodWords.error || friendships.error) throw new Error("export failed");

  const friendRows = (friendships.data ?? []) as Array<{ user_low: string; user_high: string; accepted_at: string }>;
  const friendIds = friendRows.map((f) => (f.user_low === userId ? f.user_high : f.user_low));
  const { data: friendProfiles } =
    friendIds.length > 0 ? await supabase.from("profiles").select("user_id, display_name").in("user_id", friendIds) : { data: [] };
  const friendName = new Map((friendProfiles ?? []).map((p) => [p.user_id as string, (p.display_name as string | null) ?? ""]));

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
    friends: friendRows.map((f, i) => ({ name: friendName.get(friendIds[i]) ?? "", since: f.accepted_at })),
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
