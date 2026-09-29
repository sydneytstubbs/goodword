import NextLink from "next/link";
import { Wordmark } from "@/components/domain/wordmark";
import { listMyGroups, newGoodWordCounts } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { AddProvider } from "./add";
import { AppNav } from "./app-nav";
import { GoodWordsProvider } from "./good-words";
import { OfflineBanner } from "./offline-banner";
import { ShelfNewsProvider } from "./shelf-news";

// Signed-in chrome: the tab bar or rail (DS 4.2.8), with Add opening the
// search sheet from any screen, and the viewer's good words written
// optimistically everywhere at once. Each page still checks who's signed in;
// New good words since your last visit badge the Shelf tab and switcher
// (PRD F5.5). The full top bar with Activity (DS 4.2.8) arrives with step 6.
export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const [groups, profile, newCounts] = userId
    ? await Promise.all([
        listMyGroups(userId),
        supabase.from("profiles").select("display_name").eq("user_id", userId).maybeSingle(),
        newGoodWordCounts(),
      ])
    : [[], null, {}];
  const viewer = { id: userId ?? "", name: (profile?.data?.display_name as string | null | undefined) ?? "" };

  return (
    <GoodWordsProvider viewer={viewer} groups={groups}>
      <ShelfNewsProvider counts={newCounts}>
        <AddProvider>
          <div className="pb-tabbar-safe lg:ps-rail lg:pb-0">
            <header className="flex h-14 items-center px-4 lg:hidden">
              <NextLink href="/shelf" aria-label={t("wordmark.name")}>
                <Wordmark />
              </NextLink>
            </header>
            <div className="lg:pt-8">
              <OfflineBanner />
              {children}
            </div>
          </div>
          <AppNav groups={groups.map(({ id, name }) => ({ id, name }))} />
        </AddProvider>
      </ShelfNewsProvider>
    </GoodWordsProvider>
  );
}
