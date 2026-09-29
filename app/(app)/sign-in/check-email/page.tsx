import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/domain/wordmark";
import { Icon } from "@/components/icon";
import { Button } from "@/components/ui/button";
import { safeNext } from "@/lib/auth/paths";
import { readSignInRequest } from "@/lib/auth/signin-request";
import { inviteContext } from "@/lib/groups/queries";
import { t, tRich } from "@/lib/messages";
import { useDifferentEmail } from "../actions";
import { ResendLink } from "./resend-link";

export const metadata: Metadata = { title: "Check your email · Good Word" };

export default async function CheckEmailPage({ searchParams }: PageProps<"/sign-in/check-email">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const joining = await inviteContext(next);
  const request = await readSignInRequest();
  if (!request) redirect(`/sign-in?next=${encodeURIComponent(next)}`);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-reading flex-col gap-8 px-4 py-12 md:justify-center">
      <Wordmark />
      {joining && (
        <p className="flex items-center gap-2 text-label text-muted">
          <Icon name="group" size={20} />
          {t("join.joining", { group: joining })}
        </p>
      )}
      <div className="flex flex-col gap-2">
        <h1 className="text-display-m text-default">{t("auth.checkEmail.title")}</h1>
        <p className="text-body text-muted break-words">{tRich("auth.checkEmail.body", { email: request.email })}</p>
      </div>
      <div className="flex flex-col items-start gap-2">
        <ResendLink next={next} initialSeconds={request.secondsLeft} justSent={params.sent === "1"} />
        <form action={useDifferentEmail}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="ghost">
            {t("auth.checkEmail.differentEmail")}
          </Button>
        </form>
      </div>
    </main>
  );
}
