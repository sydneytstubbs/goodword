import type { Metadata } from "next";
import NextLink from "next/link";
import { Icon } from "@/components/icon";
import { GroupDot } from "@/components/ui/chip";
import { Banner } from "@/components/ui/banner";
import { ButtonLink } from "@/components/ui/button-link";
import { TextLink } from "@/components/ui/text-link";
import { requireOnboardedUser } from "@/lib/auth/session";
import { myList } from "@/lib/good-words/queries";
import { recordEvent } from "@/lib/events/server";
import { filterKeys } from "@/lib/events/list";
import { listMyGroups } from "@/lib/groups/queries";
import { unfinishedImport } from "@/lib/import/queries";
import { deckHref } from "@/lib/import/paths";
import { t } from "@/lib/messages";
import { HomeScreenTip } from "./home-screen-tip";
import { MyListCards } from "./my-list-cards";

export const metadata: Metadata = { title: "My list · Good Word" };

// The My list tab (PRD F5.3, DS 4.2.8): your own good words first, then your
// groups, then Settings and Help (Sign out lives in Settings). Filters
// include which of your groups it's in (F5.3).
export default async function MyListPage({ searchParams }: PageProps<"/you">) {
  const { user, profile } = await requireOnboardedUser("/you");
  const [groups, list, unfinished] = await Promise.all([
    listMyGroups(user.id),
    myList(user.id, profile.display_name, profile.region),
    unfinishedImport(),
  ]);
  await recordEvent("list_viewed", { list: "mine", filters: filterKeys(await searchParams), new_count: 0 }, user.id);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-10 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h1 className="text-title-l text-default">{t("you.title")}</h1>
        <ButtonLink href="/you/import" icon="add" className="self-start sm:self-auto">
          {t("importRecs.openButton")}
        </ButtonLink>
      </div>
      {unfinished && (
        <Banner
          icon="edit"
          action={
            <TextLink href={deckHref(unfinished.importId, unfinished.position)} variant="standalone">
              {t("importRecs.finish")}
            </TextLink>
          }
        >
          {t("importRecs.resume", { count: unfinished.left })}
        </Banner>
      )}
      <HomeScreenTip />

      <MyListCards list={list} />

      <section className="flex max-w-reading flex-col gap-3">
        <h2 className="text-title-m text-default">{t("you.groupsHeading")}</h2>
        {groups.length === 0 ? (
          <p className="text-body text-muted">{t("you.noGroups")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-subtle">
            {groups.map((group) => (
              <li key={group.id}>
                <NextLink
                  href={`/list/${group.id}`}
                  className="-mx-2 flex min-h-14 items-center gap-3 rounded-control px-2 transition duration-fast ease-standard hover:bg-surface-hover"
                >
                  <span className="grid size-5 place-items-center">
                    <GroupDot group={group} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-body text-default">{group.name}</span>
                    <span className="text-caption text-muted">{t("groups.members", { count: group.members.length })}</span>
                  </span>
                </NextLink>
              </li>
            ))}
          </ul>
        )}
        <TextLink href="/groups/new" variant="standalone" className="gap-2 self-start">
          <Icon name="add" size={20} />
          {t("groups.createGroup")}
        </TextLink>
      </section>

      <section className="flex max-w-reading flex-col items-start gap-3">
        <h2 className="text-title-m text-default">{t("you.accountHeading")}</h2>
        <p className="text-body text-muted">{t("you.signedInAs", { name: profile.display_name })}</p>
        <TextLink href="/you/settings" variant="standalone" className="gap-2">
          <Icon name="settings" size={20} />
          {t("you.settingsLink")}
        </TextLink>
        <TextLink href="/you/help" variant="standalone" className="gap-2">
          <Icon name="help" size={20} />
          {t("you.helpLink")}
        </TextLink>
      </section>
    </main>
  );
}
