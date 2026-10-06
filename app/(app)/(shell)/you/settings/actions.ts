"use server";

import { redirect } from "next/navigation";
import type { EmailPref } from "@/lib/email/secrets";
import { recordEvent } from "@/lib/events/server";
import { setNotice } from "@/lib/notice";
import { isRegion } from "@/lib/regions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Settings › Notifications (PRD F7.7): one switch, saved immediately. */
export async function setNotificationPref(pref: EmailPref, on: boolean): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_notification_pref", { p_key: pref, p_on: on });
  const ok = !error && data === true;
  if (ok) await recordEvent("notification_pref_changed", { type: pref, enabled: on });
  return ok;
}

export type SaveResult = { ok: true } | { ok: false; error: "nameRequired" | "failed" };

/** Settings › Account: your name (1 to 30 characters, PRD F1). */
export async function saveName(raw: string): Promise<SaveResult> {
  const name = raw.trim().replace(/\s+/g, " ").slice(0, 30);
  if (!name) return { ok: false, error: "nameRequired" };
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { ok: false, error: "failed" };
  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("user_id", data.user.id);
  if (error) return { ok: false, error: "failed" };
  return { ok: true };
}

/** Settings › Account: region, for where to watch (PRD F1). */
export async function saveRegion(region: string): Promise<boolean> {
  if (!isRegion(region)) return false;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return false;
  const { error } = await supabase.from("profiles").update({ region }).eq("user_id", data.user.id);
  return !error;
}

/** Settings › Streaming services (P1): the whole set for your region, saved on each tick. */
export async function saveStreamingServices(region: string, providerIds: number[]): Promise<boolean> {
  if (!isRegion(region) || !Array.isArray(providerIds) || providerIds.length > 100) return false;
  const ids = providerIds.filter((id) => Number.isInteger(id) && id > 0);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_streaming_services", { p_region: region, p_providers: ids });
  return !error && data === true;
}

/** Settings › Share my list (F9): on makes a new link, off stops the old one at once. */
export async function setShareLink(on: boolean): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_share_link", { p_on: on });
  if (error || typeof data !== "string") return null;
  await recordEvent("share_link_toggled", { enabled: on });
  return data;
}

/** Settings › Share my list › Reset link (F9): a new link; the old one stops working. */
export async function resetShareLink(): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reset_share_link");
  return error || typeof data !== "string" ? null : data;
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}

/**
 * Delete my account (PRD F1): leave every group (ownership passes on), then
 * delete the auth user, which removes everything else. Immediate for the
 * person; it lands on sign-in with a notice.
 */
export async function deleteAccount(): Promise<{ ok: false }> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect("/sign-in");
  const prepared = await supabase.rpc("prepare_account_deletion");
  if (prepared.error) {
    console.error("account deletion: prepare failed", prepared.error.code);
    return { ok: false };
  }
  const deleted = await createAdminClient().auth.admin.deleteUser(data.user.id);
  if (deleted.error) {
    console.error("account deletion: delete failed", deleted.error.status);
    return { ok: false };
  }
  await supabase.auth.signOut();
  await setNotice("accountDeleted", {});
  redirect("/sign-in");
}
