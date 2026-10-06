import { Wordmark } from "@/components/domain/wordmark";
import { Avatar } from "@/components/ui/avatar";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { TextLink } from "@/components/ui/text-link";
import { t } from "@/lib/messages";

// A friend link's landing (PRD F16.1, DS 5.20): whose link it is, one
// sentence, and one button. Never their good words before you accept.
export function FriendLanding({
  code,
  inviter,
  signedIn,
  error,
}: {
  code: string;
  inviter: { id: string; name: string };
  signedIn: boolean;
  error?: string;
}) {
  const acceptPath = `/join/${code}/accept`;
  const problem = error === "slow" ? t("join.slowDown") : error === "failed" ? t("friends.failed") : null;
  const action = t("friends.landingAction", { name: inviter.name });

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-reading flex-col gap-8 px-4 py-12 md:justify-center">
      <Wordmark />
      <div className="flex flex-col gap-4">
        <Avatar person={inviter} size={56} decorative />
        <h1 className="text-display-m text-default break-words">{t("friends.landingTitle", { name: inviter.name })}</h1>
        <p className="text-body text-muted">{t("friends.landingBody")}</p>
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
              {action}
            </Button>
          </form>
        ) : (
          <ButtonLink href={`/sign-in?next=${encodeURIComponent(acceptPath)}`} variant="primary" size="lg" fullWidth>
            {action}
          </ButtonLink>
        )}
        <TextLink href="/" variant="standalone">
          {t("join.learnMore")}
        </TextLink>
      </div>
    </main>
  );
}
