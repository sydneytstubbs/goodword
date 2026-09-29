import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { Wordmark } from "@/components/domain/wordmark";
import { safeNext } from "@/lib/auth/paths";
import { readSignInRequest } from "@/lib/auth/signin-request";
import { t } from "@/lib/messages";
import { resendFromBanner } from "./actions";
import { SignInForm } from "./sign-in-form";

export const metadata: Metadata = { title: "Sign in · Good Word" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const expired = params.error === "expired";
  const googleFailed = params.error === "google";

  // After an expired link, offer one tap to resend when this browser knows the address.
  const previous = expired ? await readSignInRequest() : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-reading flex-col gap-8 px-4 py-12 md:justify-center">
      <Wordmark />
      <div className="flex flex-col gap-2">
        <h1 className="text-display-m text-default">{t("auth.signIn.title")}</h1>
        <p className="text-body text-muted">{t("auth.signIn.body")}</p>
      </div>
      <SignInForm
        next={next}
        expired={expired}
        googleFailed={googleFailed}
        resendAction={
          previous && (
            <form action={resendFromBanner}>
              <input type="hidden" name="next" value={next} />
              <Button type="submit" variant="secondary" size="sm">
                {t("auth.signIn.sendNew")}
              </Button>
            </form>
          )
        }
      />
    </main>
  );
}
