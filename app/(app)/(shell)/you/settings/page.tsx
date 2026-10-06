import type { Metadata } from "next";
import { requireOnboardedUser } from "@/lib/auth/session";
import { t } from "@/lib/messages";
import { siteOrigin } from "@/lib/origin";
import { regionOptions } from "@/lib/regions";
import { createClient } from "@/lib/supabase/server";
import { safeRegion } from "@/lib/titles/providers";
import { fetchRegionProviders } from "@/lib/tmdb/client";
import type { Provider } from "@/lib/tmdb/normalize";
import { AccountSettings } from "./account";
import { NotificationSettings, type Prefs } from "./notifications";
import { StreamingServices } from "./services";
import { ShareList } from "./share-list";
import { YourData } from "./your-data";

export const metadata: Metadata = { title: "Settings · Good Word" };

// Settings (PRD F11, DS 5.16), grouped: Account, Streaming services (P1),
// Notifications (F7.7), Share my list (F9), Your data (F1). Email footers
// link to #notifications; "On my services" links to #services.
export default async function SettingsPage() {
  const { user, profile } = await requireOnboardedUser("/you/settings");
  const supabase = await createClient();
  const region = safeRegion(profile.region);
  const [{ data, error }, services, share, providers] = await Promise.all([
    supabase.from("notification_prefs").select("digest, mention_email, group_joins, weekend_prompt").eq("user_id", user.id).maybeSingle(),
    supabase.from("streaming_services").select("provider_ids").eq("user_id", user.id).eq("region", region).maybeSingle(),
    supabase.from("share_links").select("enabled, token, view_count").eq("user_id", user.id).maybeSingle(),
    // If TMDB is down, the rest of Settings still works.
    fetchRegionProviders(region).catch((): Provider[] => []),
  ]);
  if (error || services.error || share.error) throw new Error("settings didn't load");
  // No row yet means the defaults: everything on.
  const prefs: Prefs = {
    digest: data?.digest ?? true,
    mention_email: data?.mention_email ?? true,
    group_joins: data?.group_joins ?? true,
    weekend_prompt: data?.weekend_prompt ?? true,
  };

  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-10 px-4 py-8">
      <h1 className="text-title-l text-default">{t("settings.title")}</h1>
      <Section id="account" title={t("settings.accountHeading")}>
        <AccountSettings name={profile.display_name} email={user.email ?? ""} region={profile.region} regions={regionOptions()} />
      </Section>
      <Section id="services" title={t("settings.servicesHeading")} intro={t("settings.servicesIntro")}>
        <StreamingServices key={region} region={region} providers={providers} initial={(services.data?.provider_ids as number[] | undefined) ?? []} />
      </Section>
      <Section id="notifications" title={t("settings.notificationsHeading")} intro={t("settings.notificationsIntro")}>
        <NotificationSettings initial={prefs} />
      </Section>
      <Section id="share" title={t("settings.shareHeading")} intro={t("settings.shareIntro")}>
        <ShareList
          origin={await siteOrigin()}
          initial={{ enabled: share.data?.enabled ?? false, token: (share.data?.token as string | undefined) ?? null, views: share.data?.view_count ?? 0 }}
        />
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
