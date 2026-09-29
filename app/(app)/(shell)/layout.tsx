import NextLink from "next/link";
import { Wordmark } from "@/components/domain/wordmark";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { createClient } from "@/lib/supabase/server";
import { AddProvider } from "./add";
import { AppNav } from "./app-nav";

// Signed-in chrome: the tab bar or rail (DS 4.2.8), with Add opening the
// search sheet from any screen. Each page still checks who's signed in; the
// full top bar with Activity (DS 4.2.8) arrives with step 6.
export default async function ShellLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  const groups = userId ? await listMyGroups(userId) : [];

  return (
    <AddProvider>
      <div className="pb-tabbar-safe lg:ps-rail lg:pb-0">
        <header className="flex h-14 items-center px-4 lg:hidden">
          <NextLink href="/shelf" aria-label={t("wordmark.name")}>
            <Wordmark />
          </NextLink>
        </header>
        <div className="lg:pt-8">{children}</div>
      </div>
      <AppNav groups={groups.map(({ id, name }) => ({ id, name }))} />
    </AddProvider>
  );
}
