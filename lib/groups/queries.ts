import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Member = { id: string; name: string; role: "owner" | "member"; joinedAt: string };

export type GroupSummary = { id: string; name: string; members: Array<{ id: string; name: string }> };

export type GroupDetail = {
  id: string;
  name: string;
  ownerId: string;
  members: Member[];
  inviteCode: string | null;
  me: { role: "owner" | "member"; welcomeSeenAt: string | null };
};

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function names(supabase: Supabase, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string>();
  const { data } = await supabase.from("profiles").select("user_id, display_name").in("user_id", userIds);
  return new Map((data ?? []).map((p) => [p.user_id as string, (p.display_name as string | null) ?? ""]));
}

/** The signed-in user's groups, most recently joined first, with members for the switcher. RLS-scoped. */
export const listMyGroups = cache(async (userId: string): Promise<GroupSummary[]> => {
  const supabase = await createClient();
  const { data: mine } = await supabase
    .from("group_members")
    .select("group_id, joined_at")
    .eq("user_id", userId)
    .order("joined_at", { ascending: false });
  const ids = (mine ?? []).map((m) => m.group_id as string);
  if (ids.length === 0) return [];

  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("groups").select("id, name").in("id", ids),
    supabase.from("group_members").select("group_id, user_id, joined_at").in("group_id", ids).order("joined_at"),
  ]);
  const nameOf = await names(supabase, [...new Set((members ?? []).map((m) => m.user_id as string))]);
  const byId = new Map((groups ?? []).map((g) => [g.id as string, g.name as string]));

  return ids
    .filter((id) => byId.has(id))
    .map((id) => ({
      id,
      name: byId.get(id)!,
      members: (members ?? [])
        .filter((m) => m.group_id === id)
        .map((m) => ({ id: m.user_id as string, name: nameOf.get(m.user_id as string) ?? "" })),
    }));
});

/** A group the signed-in user belongs to, or null (not a member, or no such group: never say which). */
export const getGroup = cache(async (groupId: string, userId: string): Promise<GroupDetail | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(groupId)) return null;
  const supabase = await createClient();
  const { data: group } = await supabase.from("groups").select("id, name, owner_id").eq("id", groupId).maybeSingle();
  if (!group) return null;

  const [{ data: rows }, { data: invite }] = await Promise.all([
    supabase.from("group_members").select("user_id, role, joined_at, welcome_seen_at").eq("group_id", groupId).order("joined_at"),
    supabase.from("invites").select("code").eq("group_id", groupId).is("revoked_at", null).maybeSingle(),
  ]);
  const nameOf = await names(supabase, (rows ?? []).map((r) => r.user_id as string));
  const mine = (rows ?? []).find((r) => r.user_id === userId);
  if (!mine) return null;

  return {
    id: group.id as string,
    name: group.name as string,
    ownerId: group.owner_id as string,
    inviteCode: (invite?.code as string | undefined) ?? null,
    me: { role: mine.role as "owner" | "member", welcomeSeenAt: mine.welcome_seen_at as string | null },
    members: (rows ?? []).map((r) => ({
      id: r.user_id as string,
      name: nameOf.get(r.user_id as string) ?? "",
      role: r.role as "owner" | "member",
      joinedAt: r.joined_at as string,
    })),
  };
});

export type InvitePreview =
  | { status: "invalid" }
  | { status: "expired"; ownerName: string }
  | {
      status: "active";
      groupId: string;
      groupName: string;
      memberCount: number;
      inviter: { id: string; name: string };
    };

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";

/**
 * What an invite link shows before joining (F2.4): inviter, group name, and
 * member count. Never the shelf. Service role, because the visitor isn't a
 * member yet; only these fields leave this function.
 */
export const getInvitePreview = cache(async (code: string): Promise<InvitePreview> => {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(code)) return { status: "invalid" };
  const admin = createAdminClient();
  const { data: invite } = await admin.from("invites").select("group_id, created_by, revoked_at").eq("code", code).maybeSingle();
  if (!invite) return { status: "invalid" };

  const { data: group } = await admin.from("groups").select("id, name, owner_id").eq("id", invite.group_id).maybeSingle();
  if (!group) return { status: "invalid" };

  const { data: memberRows } = await admin.from("group_members").select("user_id").eq("group_id", group.id);
  const memberIds = new Set((memberRows ?? []).map((m) => m.user_id as string));
  // The person who made the link, or the owner if they've since left.
  const inviterId = invite.created_by && memberIds.has(invite.created_by) ? (invite.created_by as string) : (group.owner_id as string);
  const { data: profiles } = await admin.from("profiles").select("user_id, display_name").in("user_id", [inviterId, group.owner_id]);
  const nameOf = (id: string) => firstName((profiles ?? []).find((p) => p.user_id === id)?.display_name ?? "");

  if (invite.revoked_at) return { status: "expired", ownerName: nameOf(group.owner_id as string) };
  return {
    status: "active",
    groupId: group.id as string,
    groupName: group.name as string,
    memberCount: memberIds.size,
    inviter: { id: inviterId, name: nameOf(inviterId) },
  };
});

/** "Joining College crew" on sign-in screens when the user is on their way to join (DS 5.2). */
export async function inviteContext(next: string): Promise<string | null> {
  const match = next.match(/^\/join\/([A-Za-z0-9_-]+)(?:\/accept)?(?:[?#].*)?$/);
  if (!match) return null;
  const preview = await getInvitePreview(match[1]);
  return preview.status === "active" ? preview.groupName : null;
}
