import "server-only";
import { recordEvent } from "@/lib/events/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readUnsubscribeToken, type EmailPref } from "./secrets";

/**
 * Turn one kind of email on or off from a signed link, without signing in
 * (PRD F7.7). Returns the preference it changed, or null for a bad token or
 * a failed write.
 */
export async function setPrefFromToken(token: string | null | undefined, on: boolean): Promise<EmailPref | null> {
  const parsed = readUnsubscribeToken(token);
  if (!parsed) return null;
  const { error } = await createAdminClient()
    .from("notification_prefs")
    .upsert({ user_id: parsed.userId, [parsed.pref]: on }, { onConflict: "user_id" });
  if (error) {
    console.error("unsubscribe failed", error.code);
    return null;
  }
  await recordEvent("notification_pref_changed", { type: parsed.pref, enabled: on }, parsed.userId);
  return parsed.pref;
}
