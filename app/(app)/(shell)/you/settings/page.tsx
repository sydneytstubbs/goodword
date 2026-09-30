import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { t } from "@/lib/messages";
import { regionOptions } from "@/lib/regions";
import { createClient } from "@/lib/supabase/server";
import { AccountSettings } from "./account";
import { NotificationSettings, type Prefs } from "./notifications";
import { YourData } from "./your-data";

export const metadata: Metadata = { title: "Settings · Good Word" };

// Settings (PRD F11, DS 5.16), grouped: Account, Notifications (F7.7), Your
// data (F1). Email footers link to #notifications.
export default async function SettingsPage() {
  const { user, profile } = await requireOnboardedUser("/you/settings");
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
      <Section id="account" title={t("settings.accountHeading")}>
        <AccountSettings name={profile.display_name} email={user.email ?? ""} region={profile.region} regions={regionOptions()} />
      </Section>
      <Section id="notifications" title={t("settings.notificationsHeading")} intro={t("settings.notificationsIntro")}>
        <NotificationSettings initial={prefs} />
      </Section>
      <Section id="your-data" title={t("settings.dataHeading")}>
        <YourData />
      </Section>
    </main>
  );
}

function Section({ id, title, intro, children }: { id: string; title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="flex flex-col gap-3">
      <h2 id={`${id}-heading`} className="text-title-m text-default">
        {title}
      </h2>
      {intro && <p className="text-body text-muted">{intro}</p>}
      {children}
    </section>
  );
}
