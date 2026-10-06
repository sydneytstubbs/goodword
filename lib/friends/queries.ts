import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { listMyGroups } from "@/lib/groups/queries";

// Friends (PRD F16.1). Everything here is read as the signed-in person under
// row-level security: you can only read friendship rows you're in, and names
// of friends, people in a request with you, and people in your groups.

export type FriendPerson = { id: string; name: string };
export type GroupPerson = FriendPerson & { groupName: string };

export type FriendsOverview = {
  /** Your friend link's code, made the first time it's asked for. */
  linkCode: string;
  /** Requests to you, newest first. */
  incoming: FriendPerson[];
  /** People in your groups you're not friends with and haven't asked. */
  fromGroups: GroupPerson[];
  /** Your friends, by name. */
  friends: FriendPerson[];
  /** Requests you've sent, newest first. */
  sent: FriendPerson[];
};

type FriendshipRow = {
  user_low: string;
  user_high: string;
  status: "pending" | "accepted";
  requested_by: string;
  created_at: string;
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Your friendship rows: accepted friends, and requests either way. */
async function friendshipRows(supabase: Supabase, userId: string): Promise<FriendshipRow[]> {
  const { data, error } = await supabase
    .from("friendships")
    .select("user_low, user_high, status, requested_by, created_at")
    .or(`user_low.eq.${userId},user_high.eq.${userId}`)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`friendships: ${error.code}`);
  return (data ?? []) as FriendshipRow[];
}

const otherOf = (row: FriendshipRow, userId: string) => (row.user_low === userId ? row.user_high : row.user_low);

async function namesOf(supabase: Supabase, ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", ids);
  return new Map((data ?? []).map((p) => [p.user_id as string, (p.display_name as string | null) ?? ""]));
}

const byName = (a: FriendPerson, b: FriendPerson) => a.name.localeCompare(b.name, "en", { sensitivity: "base" });

/** Everything the Friends screen shows (DS 5.20). */
export async function friendsOverview(userId: string): Promise<FriendsOverview> {
  const supabase = await createClient();
  const [rows, groups, link] = await Promise.all([
    friendshipRows(supabase, userId),
    listMyGroups(userId),
    supabase.rpc("my_friend_link"),
  ]);
  if (link.error || !link.data) throw new Error(`friend link: ${link.error?.code}`);

  const related = new Set(rows.map((r) => otherOf(r, userId)));
  // Each co-member once, labeled with the most recently joined group you share.
  const fromGroupIds = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) {
      if (member.id !== userId && !related.has(member.id) && !fromGroupIds.has(member.id)) fromGroupIds.set(member.id, group.name);
    }
  }
  const coMemberNames = new Map(groups.flatMap((g) => g.members.map((m) => [m.id, m.name] as const)));
  const names = await namesOf(supabase, [...related]);
  const person = (id: string): FriendPerson => ({ id, name: names.get(id) ?? coMemberNames.get(id) ?? "" });

  return {
    linkCode: link.data as string,
    incoming: rows.filter((r) => r.status === "pending" && r.requested_by !== userId).map((r) => person(otherOf(r, userId))),
    fromGroups: [...fromGroupIds]
      .map(([id, groupName]) => ({ id, name: coMemberNames.get(id) ?? "", groupName }))
      .sort(byName),
    friends: rows.filter((r) => r.status === "accepted").map((r) => person(otherOf(r, userId))).sort(byName),
    sent: rows.filter((r) => r.status === "pending" && r.requested_by === userId).map((r) => person(otherOf(r, userId))),
  };
}

/**
 * People in a group you're not friends with and haven't asked or been asked
 * by: the one-time prompt after joining (F16.1). Empty once dismissed.
 */
export const friendPromptPeople = cache(async (groupId: string, userId: string): Promise<FriendPerson[]> => {
  const supabase = await createClient();
  const [rows, { data: members }] = await Promise.all([
    friendshipRows(supabase, userId),
    supabase.from("group_members").select("user_id").eq("group_id", groupId),
  ]);
  const related = new Set(rows.map((r) => otherOf(r, userId)));
  const ids = (members ?? []).map((m) => m.user_id as string).filter((id) => id !== userId && !related.has(id));
  const names = await namesOf(supabase, ids);
  return ids.map((id) => ({ id, name: names.get(id) ?? "" })).sort(byName);
});

/** How many friends you have: for the audience line (PRD F16.2). Zero if it can't be read. */
export const friendCount = cache(async (userId: string): Promise<number> => {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("friendships")
    .select("id", { count: "exact", head: true })
    .eq("status", "accepted")
    .or(`user_low.eq.${userId},user_high.eq.${userId}`);
  return error ? 0 : (count ?? 0);
});
