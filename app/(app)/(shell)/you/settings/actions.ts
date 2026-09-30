"use server";

import { redirect } from "next/navigation";
import type { EmailPref } from "@/lib/email/secrets";
import { setNotice } from "@/lib/notice";
import { isRegion } from "@/lib/regions";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Settings › Notifications (PRD F7.7): one switch, saved immediately. */
export async function setNotificationPref(pref: EmailPref, on: boolean): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_notification_pref", { p_key: pref, p_on: on });
  return !error && data === true;
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
