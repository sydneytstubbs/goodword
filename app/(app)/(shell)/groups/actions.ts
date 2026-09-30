"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { peopleTone } from "@/lib/people-color";
import { setNotice } from "@/lib/notice";
import { recordEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";

export type CreateState = { error?: "nameRequired" | "tooManyGroups" | "failed"; name?: string };

const cleanName = (value: FormDataEntryValue | null) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 40);

export async function createGroup(_prev: CreateState, formData: FormData): Promise<CreateState> {
  const name = cleanName(formData.get("name"));
  if (!name) return { error: "nameRequired", name };

  const id = randomUUID();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_group", { p_id: id, p_name: name, p_color: peopleTone(id) });
  if (error) return { error: "failed", name };
  if (data === "too_many_groups") return { error: "tooManyGroups", name };
  await recordEvent("group_created", { group_id: id });
  redirect(`/groups/${id}`);
}

export type Result = { ok: boolean; code?: string };

export async function renameGroup(groupId: string, rawName: string): Promise<Result> {
  const name = cleanName(rawName);
  if (!name) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("rename_group", { p_group: groupId, p_name: name });
  revalidatePath(`/groups/${groupId}`);
  return { ok: !error && data === true };
}

export async function resetInvite(groupId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_invite", { p_group: groupId });
  if (error || !data) return { ok: false };
  revalidatePath(`/groups/${groupId}`);
  return { ok: true, code: data as string };
}

export async function removeMember(groupId: string, userId: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_member", { p_group: groupId, p_user: userId });
  revalidatePath(`/groups/${groupId}`);
  return { ok: !error && data === true };
}

export async function leaveGroup(groupId: string, groupName: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("leave_group", { p_group: groupId });
  if (error || (data !== "left" && data !== "deleted")) return { ok: false };
  await setNotice(data === "deleted" ? "deleted" : "left", { group: groupName });
  redirect("/shelf");
}

export async function deleteGroup(groupId: string, groupName: string): Promise<Result> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_group", { p_group: groupId });
  if (error || data !== true) return { ok: false };
  await setNotice("deleted", { group: groupName });
  redirect("/shelf");
}

export async function markWelcomeSeen(groupId: string) {
  const supabase = await createClient();
  await supabase.rpc("mark_welcome_seen", { p_group: groupId });
}
