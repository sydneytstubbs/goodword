"use server";

import { createClient } from "@/lib/supabase/server";
import type { EmailPref } from "@/lib/email/secrets";

/** Settings › Notifications (PRD F7.7): one switch, saved immediately. */
export async function setNotificationPref(pref: EmailPref, on: boolean): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_notification_pref", { p_key: pref, p_on: on });
  return !error && data === true;
}
