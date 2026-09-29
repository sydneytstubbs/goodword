import type { Metadata } from "next";
import NextLink from "next/link";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { GroupDot } from "@/components/ui/chip";
import { TextLink } from "@/components/ui/text-link";
import { requireOnboardedUser } from "@/lib/auth/session";
import { myShelf } from "@/lib/good-words/queries";
import { listMyGroups } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { signOut } from "./actions";
import { MyShelfCards } from "./my-shelf-cards";

export const metadata: Metadata = { title: "My shelf · Good Word" };

// The My shelf tab (PRD F5.3, DS 4.2.8): your own good words first, then your
// groups, then account. Settings and Help arrive with step 8, which moves
// Sign out into Settings. Filters include which of your groups it's in (F5.3).
export default async function MyShelfPage() {
  const { user, profile } = await requireOnboardedUser("/you");
  const [groups, shelf] = await Promise.all([
    listMyGroups(user.id),
    myShelf(user.id, profile.display_name, profile.region),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-content flex-col gap-10 px-4 py-8">
      <h1 className="text-title-l text-default">{t("you.title")}</h1>

      <MyShelfCards shelf={shelf} />

      <section className="flex max-w-reading flex-col gap-3">
        <h2 className="text-title-m text-default">{t("you.groupsHeading")}</h2>
        {groups.length === 0 ? (
          <p className="text-body text-muted">{t("you.noGroups")}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-subtle">
            {groups.map((group) => (
              <li key={group.id}>
                <NextLink
                  href={`/shelf/${group.id}`}
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
        <form action={signOut}>
          <Button type="submit" variant="secondary" icon="signOut">
            {t("you.signOut")}
          </Button>
        </form>
      </section>
    </main>
  );
}
