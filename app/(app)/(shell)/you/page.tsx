import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { requireOnboardedUser } from "@/lib/auth/session";
import { t } from "@/lib/messages";
import { signOut } from "./actions";

export const metadata: Metadata = { title: "You · Good Word" };

export default async function YouPage() {
  const { profile } = await requireOnboardedUser("/you");
  return (
    <main className="mx-auto flex w-full max-w-reading flex-col gap-6 px-4 py-8">
      <h1 className="text-display-m text-default">{t("you.title")}</h1>
      <p className="text-body text-muted">{t("you.signedInAs", { name: profile.display_name })}</p>
      <form action={signOut}>
        <Button type="submit" variant="secondary" icon="signOut">
          {t("you.signOut")}
        </Button>
      </form>
    </main>
  );
}
