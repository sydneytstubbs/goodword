import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { t } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { NotificationSettings, type Prefs } from "./notifications";

export const metadata: Metadata = { title: "Settings · Good Word" };

// Settings (PRD F11, DS 5.16). Step 7 brings Notifications (F7.7); step 8
// adds Account, Your data, and About. Email footers link here.
export default async function SettingsPage() {
  const { user } = await requireOnboardedUser("/you/settings");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_prefs")
    .select("digest, mention_email, group_joins")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) throw new Error("settings didn't load");
  // No row yet means the defaults: everything on.
  const prefs: Prefs = { digest: data?.digest ?? true, mention_email: data?.mention_email ?? true, group_joins: data?.group_joins ?? true };

  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-10 px-4 py-8">
      <h1 className="text-title-l text-default">{t("settings.title")}</h1>
      <section id="notifications" aria-labelledby="notifications-heading" className="flex flex-col gap-3">
        <h2 id="notifications-heading" className="text-title-m text-default">
          {t("settings.notificationsHeading")}
        </h2>
        <p className="text-body text-muted">{t("settings.notificationsIntro")}</p>
        <NotificationSettings initial={prefs} />
      </section>
    </main>
  );
}
