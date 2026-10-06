import { safeRegion } from "@/lib/titles/providers";
import { unreadActivityCount } from "@/lib/conversations/queries";
import { friendCount } from "@/lib/friends/queries";
import { listMyGroups, newGoodWordCounts } from "@/lib/groups/queries";
import { createClient } from "@/lib/supabase/server";
import { ActivityCountProvider } from "./activity-count";
import { AddProvider } from "./add";
import { AppNav } from "./app-nav";
import { GoodWordsProvider } from "./good-words";
import { ListNewsProvider } from "./list-news";
import { ShellChrome } from "./shell-chrome";

// Signed-in chrome: the tab bar or rail (DS 4.2.8), with Add opening the
// search sheet from any screen, and the viewer's good words written
// optimistically everywhere at once. Each page still checks who's signed in;
// New good words since your last visit badge the List tab and switcher
// (PRD F5.5). The Activity bell's unread count stays live (PRD F14).
export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const [groups, profile, newCounts, activityCount] = userId
    ? await Promise.all([
        listMyGroups(userId),
        supabase.from("profiles").select("display_name, region, home_enabled").eq("user_id", userId).maybeSingle(),
        newGoodWordCounts(),
        unreadActivityCount(),
      ])
    : [[], null, {}, 0];
  const viewer = { id: userId ?? "", name: (profile?.data?.display_name as string | null | undefined) ?? "" };
  // Your streaming services in your region, for "On my services" (P1).
  const region = safeRegion(profile?.data?.region as string | null | undefined);
  const { data: services } = userId
    ? await supabase.from("streaming_services").select("provider_ids").eq("user_id", userId).eq("region", region).maybeSingle()
    : { data: null };
  const myServices = (services?.provider_ids as number[] | null | undefined) ?? [];
  // Friends as an audience, behind the home_enabled flag (PRD F16.2, F16.10).
  const friends = userId && profile?.data?.home_enabled ? { count: await friendCount(userId) } : null;

  return (
    <GoodWordsProvider viewer={viewer} groups={groups} friends={friends} myServices={myServices}>
      <ListNewsProvider counts={newCounts}>
        <ActivityCountProvider userId={viewer.id} initialCount={activityCount}>
          <AddProvider>
            <ShellChrome>{children}</ShellChrome>
            <AppNav groups={groups.map(({ id, name }) => ({ id, name }))} home={Boolean(profile?.data?.home_enabled)} />
          </AddProvider>
        </ActivityCountProvider>
      </ListNewsProvider>
    </GoodWordsProvider>
  );
}
