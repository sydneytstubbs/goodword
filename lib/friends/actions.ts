"use server";

import { revalidatePath } from "next/cache";
import { recordEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";

// Friend actions (PRD F16.1). The database functions check who's asking and
// what's allowed; these only pass the request on and record the event.

export type FriendResult = { ok: boolean; status?: string };

const UUID = /^[0-9a-f-]{36}$/i;

function done(ok: boolean, status?: string): FriendResult {
  revalidatePath("/you/friends");
  return status ? { ok, status } : { ok };
}

/** Ask someone from your groups. Asking someone who already asked you makes you friends. */
export async function requestFriend(userId: string, from: "friends_screen" | "group_prompt"): Promise<FriendResult> {
  if (!UUID.test(userId)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("request_friend", { p_user: userId });
  if (error) return { ok: false };
  const status = data as string;
  if (status === "requested") await recordEvent("friend_request_sent", { from });
  if (status === "friends") await recordEvent("friend_added", { via: "request" });
  return done(["requested", "already_requested", "friends", "already_friends"].includes(status), status);
}

/** Accept or decline a request to you. Declining is silent (open question 13). */
export async function respondToRequest(userId: string, accept: boolean): Promise<FriendResult> {
  if (!UUID.test(userId)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_friend_request", { p_user: userId, p_accept: accept });
  if (error) return { ok: false };
  if (data === "friends") await recordEvent("friend_added", { via: "request" });
  // Already answered elsewhere counts as done.
  return done(true, data as string);
}

export async function cancelRequest(userId: string): Promise<FriendResult> {
  if (!UUID.test(userId)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_friend_request", { p_user: userId });
  return done(!error);
}

export async function removeFriend(userId: string): Promise<FriendResult> {
  if (!UUID.test(userId)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_friend", { p_user: userId });
  if (error) return { ok: false };
  if (data === true) await recordEvent("friend_removed");
  return done(true);
}

export async function resetFriendLink(): Promise<FriendResult & { code?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_friend_link");
  if (error || !data) return { ok: false };
  revalidatePath("/you/friends");
  return { ok: true, code: data as string };
}

export async function dismissFriendPrompt(groupId: string): Promise<FriendResult> {
  if (!UUID.test(groupId)) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("dismiss_friend_prompt", { p_group: groupId });
  return { ok: !error };
}

export async function markFriendActivityRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_friend_activity_read");
}
