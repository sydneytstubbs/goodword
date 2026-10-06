import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/domain/wordmark";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { EmptyState } from "@/components/ui/empty-state";
import { TextLink } from "@/components/ui/text-link";
import { getInvitePreview } from "@/lib/groups/queries";
import { t } from "@/lib/messages";
import { recordEvent } from "@/lib/events/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "You're invited · Good Word" };

// Invite landing (F2.4, DS 5.2). Who invited you, the group, how many are in
// it, and one sentence about Good Word. Never the list's contents.
export default async function JoinPage({ params, searchParams }: PageProps<"/join/[code]">) {
  const { code } = await params;
  const { error } = await searchParams;
  const preview = await getInvitePreview(code);

  if (preview.status !== "active") {
    const expired = preview.status === "expired";
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-reading flex-col gap-8 px-4 py-12 md:justify-center">
        <Wordmark />
        <h1 className="sr-only">{expired ? t("join.expiredTitle") : t("join.invalidTitle")}</h1>
        <EmptyState
          headingLevel={2}
          title={expired ? t("join.expiredTitle") : t("join.invalidTitle")}
          body={expired && preview.ownerName ? t("invite.expired", { name: preview.ownerName }) : t("join.invalid")}
          action={
            <ButtonLink href="/" variant="secondary">
              {t("join.learnMore")}
            </ButtonLink>
          }
        />
      </main>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const signedIn = Boolean(data.user);
  if (!error) await recordEvent("invite_link_opened", { group_id: preview.groupId, signed_in: signedIn }, data.user?.id ?? null);
  if (signedIn) {
    const { data: member } = await supabase.from("group_members").select("id").eq("group_id", preview.groupId).eq("user_id", data.user!.id).maybeSingle();
    // Already a member: straight to the list, with a toast.
    if (member) redirect(`/join/${code}/accept`);
  }

  const acceptPath = `/join/${code}/accept`;
  const problem =
    error === "full"
      ? t("join.full", { group: preview.groupName })
      : error === "too-many"
        ? t("join.tooManyGroups", { group: preview.groupName })
        : error === "slow"
          ? t("join.slowDown")
          : error === "failed"
            ? t("groups.details.failed")
            : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-reading flex-col gap-8 px-4 py-12 md:justify-center">
      <Wordmark />
      <div className="flex flex-col gap-4">
        <Avatar person={preview.inviter} size={56} decorative />
        <h1 className="text-display-m text-default break-words">
          {t("join.invited", { name: preview.inviter.name, group: preview.groupName })}
        </h1>
        <p className="text-body text-muted">{t("join.members", { count: preview.memberCount })}</p>
        <p className="text-body text-muted">{t("join.about")}</p>
      </div>
      {problem && (
        <Banner tone="error" blocking>
          {problem}
        </Banner>
      )}
      <div className="flex flex-col items-start gap-3">
        {signedIn ? (
          <form action={acceptPath} method="post" className="w-full">
            <Button type="submit" variant="primary" size="lg" fullWidth>
              {t("join.join", { group: preview.groupName })}
            </Button>
          </form>
        ) : (
          <ButtonLink href={`/sign-in?next=${encodeURIComponent(acceptPath)}`} variant="primary" size="lg" fullWidth>
            {t("join.join", { group: preview.groupName })}
          </ButtonLink>
        )}
        <TextLink href="/" variant="standalone">
          {t("join.learnMore")}
        </TextLink>
      </div>
    </main>
  );
}
